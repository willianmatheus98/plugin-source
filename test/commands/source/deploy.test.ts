/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import { expect } from 'chai';
import { DeployResult, MetadataApiDeployOptions } from '@salesforce/source-deploy-retrieve';
import { Dictionary } from '@salesforce/ts-types';
import { Lifecycle } from '@salesforce/core';
import { Deploy } from '../../../src/commands/force/source/deploy';
import { FlagOptions } from '../../../src/sourceCommand';

describe('force:source:deploy', () => {
  const sandbox = sinon.createSandbox();
  const username = 'deploy-test@org.com';
  const packageXml = 'package.xml';

  // TODO: When output work items have been done we can test result output
  //       that more closely matches actual output.
  const stubbedResults = 'the stubbed results';

  // Stubs
  let createComponentSetStub: sinon.SinonStub;
  let deployStub: sinon.SinonStub;
  let startStub: sinon.SinonStub;
  let lifecycleEmitStub: sinon.SinonStub;

  const run = async (flags: Dictionary<boolean | string | number | string[]> = {}): Promise<DeployResult> => {
    // Run the command
    return Deploy.prototype.run.call({
      flags: Object.assign({}, flags),
      ux: {
        log: () => {},
        styledHeader: () => {},
        table: () => {},
      },
      logger: {
        debug: () => {},
      },
      org: {
        getUsername: () => username,
      },
      createComponentSet: createComponentSetStub,
    }) as Promise<DeployResult>;
  };

  beforeEach(() => {
    startStub = sandbox.stub().returns(stubbedResults);
    deployStub = sandbox.stub().returns({ start: startStub });
    createComponentSetStub = sandbox.stub().returns({
      deploy: deployStub,
      getPackageXml: () => packageXml,
    });
    lifecycleEmitStub = sandbox.stub(Lifecycle.prototype, 'emit');
  });

  afterEach(() => {
    sandbox.restore();
  });

  // Ensure SourceCommand.createComponentSet() args
  const ensureCreateComponentSetArgs = (overrides?: Partial<FlagOptions>) => {
    const defaultArgs = {
      sourcepath: undefined,
      manifest: undefined,
      metadata: undefined,
      apiversion: undefined,
    };
    const expectedArgs = { ...defaultArgs, ...overrides };

    expect(createComponentSetStub.calledOnce).to.equal(true);
    expect(createComponentSetStub.firstCall.args[0]).to.deep.equal(expectedArgs);
  };

  // Ensure ComponentSet.deploy() args
  // TODO: remove `& { apiOptions: { testLevel: string } }` when that version of SDR is published.
  const ensureDeployArgs = (overrides?: Partial<MetadataApiDeployOptions & { apiOptions: { testLevel: string } }>) => {
    const expectedDeployArgs = {
      usernameOrConnection: username,
      apiOptions: {
        ignoreWarnings: false,
        rollbackOnError: true,
        checkOnly: false,
        runTests: undefined,
        testLevel: 'NoTestRun',
      },
    };
    if (overrides?.apiOptions) {
      expectedDeployArgs.apiOptions = { ...expectedDeployArgs.apiOptions, ...overrides.apiOptions };
    }
    expect(deployStub.calledOnce).to.equal(true);
    expect(deployStub.firstCall.args[0]).to.deep.equal(expectedDeployArgs);
  };

  // Ensure Lifecycle hooks are called properly
  const ensureHookArgs = () => {
    const failureMsg = 'Lifecycle.emit() should be called for predeploy and postdeploy';
    expect(lifecycleEmitStub.calledTwice, failureMsg).to.equal(true);
    expect(lifecycleEmitStub.firstCall.args[0]).to.equal('predeploy');
    expect(lifecycleEmitStub.firstCall.args[1]).to.deep.equal({
      packageXmlPath: packageXml,
    });
    expect(lifecycleEmitStub.secondCall.args[0]).to.equal('postdeploy');
    expect(lifecycleEmitStub.secondCall.args[1]).to.deep.equal(stubbedResults);
  };

  it('should pass along sourcepath', async () => {
    const sourcepath = ['somepath'];
    const result = await run({ sourcepath, json: true });
    expect(result).to.deep.equal(stubbedResults);
    ensureCreateComponentSetArgs({ sourcepath });
    ensureDeployArgs();
    ensureHookArgs();
  });

  it('should pass along metadata', async () => {
    const metadata = ['ApexClass:MyClass'];
    const result = await run({ metadata, json: true });
    expect(result).to.deep.equal(stubbedResults);
    ensureCreateComponentSetArgs({ metadata });
    ensureDeployArgs();
    ensureHookArgs();
  });

  it('should pass along manifest', async () => {
    const manifest = 'package.xml';
    const result = await run({ manifest, json: true });
    expect(result).to.deep.equal(stubbedResults);
    ensureCreateComponentSetArgs({ manifest });
    ensureDeployArgs();
    ensureHookArgs();
  });

  it('should pass along apiversion', async () => {
    const manifest = 'package.xml';
    const apiversion = '50.0';
    const result = await run({ manifest, apiversion, json: true });
    expect(result).to.deep.equal(stubbedResults);
    ensureCreateComponentSetArgs({ apiversion, manifest });
    ensureDeployArgs();
    ensureHookArgs();
  });

  it('should pass along all deploy options', async () => {
    const manifest = 'package.xml';
    const result = await run({
      manifest,
      ignorewarnings: true,
      ignoreerrors: true,
      checkonly: true,
      runtests: ['MyClassTest'],
      testlevel: 'RunSpecifiedTests',
      json: true,
    });

    expect(result).to.deep.equal(stubbedResults);
    ensureCreateComponentSetArgs({ manifest });

    // Ensure ComponentSet.deploy() overridden args
    ensureDeployArgs({
      apiOptions: {
        ignoreWarnings: true,
        rollbackOnError: false,
        checkOnly: true,
        runTests: ['MyClassTest'],
        testLevel: 'RunSpecifiedTests',
      },
    });
    ensureHookArgs();
  });
});
