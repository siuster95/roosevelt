/* eslint-env mocha */

const assert = require('assert')
const path = require('path')
const generateTestApp = require('../util/generateTestApp')
const cleanupTestApp = require('../util/cleanupTestApp')
const fork = require('child_process').fork
const fse = require('fs-extra')
const configAuditor = require('../../lib/scripts/configAuditor')

describe('Roosevelt config Auditor Test', function () {
  // path to the Test App Directory
  const appDir = path.join(__dirname, '../', '/app', '/configAuditorTest')

  // options to add to the generateTestApp function
  const options = {rooseveltPath: '../../../roosevelt', method: 'startServer'}

  // variable to hold the data that will be written to the package.json file for each test
  let packageJSONSource = {}

  afterEach(function (done) {
    cleanupTestApp(appDir, (err) => {
      if (err) {
        throw err
      } else {
        done()
      }
    })
  })

  beforeEach(function (done) {
    // grab the contents of the default config file
    let defaultContent = JSON.parse(fse.readFileSync(path.join(__dirname, '../', '../', 'lib', 'defaults', 'config.json')).toString('utf8'))
    // grab the content of the script file
    let scriptContent = JSON.parse(fse.readFileSync(path.join(__dirname, '../', '../', 'lib', 'defaults', 'scripts.json')).toString('utf8'))
    // add the defaultContent to packageJSONSource
    packageJSONSource.rooseveltConfig = defaultContent
    // seperate the commands from the rest of the data in the scripts file
    packageJSONSource.scripts = {}
    let keys = Object.keys(scriptContent)
    for (let x = 0; x < keys.length; x++) {
      packageJSONSource.scripts[keys[x]] = scriptContent[keys[x]].value
    }
    done()
  })

  it('should be able to scan the package.json file in the test App Directory and tell me which params are missing from it', function (done) {
    // bool vars to hold whether or not the right logs and errors are being outputted
    let startingConfigAuditBool = false
    let modelsPathMissingBool = false
    let viewsPathMissingBool = false
    let controllersPathMissingBool = false
    let error1Bool = false
    let error2Bool = false

    // write the package.json file
    fse.ensureDirSync(path.join(appDir))
    delete packageJSONSource.rooseveltConfig.modelsPath
    delete packageJSONSource.rooseveltConfig.viewsPath
    delete packageJSONSource.rooseveltConfig.controllersPath
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // look at the logs
    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    // look at the errors
    testApp.stderr.on('data', (data) => {
      if (data.includes('Missing param "modelsPath"!')) {
        modelsPathMissingBool = true
      }
      if (data.includes('Missing param "viewsPath"!')) {
        viewsPathMissingBool = true
      }
      if (data.includes('Missing param "controllersPath"!')) {
        controllersPathMissingBool = true
      }
      if (data.includes('Issues have been detected in roosevelt config')) {
        error1Bool = true
      }
      if (data.includes('for the latest sample rooseveltConfig.')) {
        error2Bool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the configAuditor')
      assert.equal(modelsPathMissingBool, true, 'configAuditor did not report that the package.json file is missing a models path value')
      assert.equal(viewsPathMissingBool, true, 'configAuditor did not report that the package.json file is missing a views path value')
      assert.equal(controllersPathMissingBool, true, 'configAuditor did not report that the package.json file is missing a controllers path value')
      assert.equal(error1Bool, true, 'configAuditor did not report that we had issues with the roosevelt config')
      assert.equal(error2Bool, true, 'configAuditor did not report where a user can go to for examples of correct syntax and values')
      done()
    })
  })

  it('should be able to require the configAuditor and run the function and get a response of the things that are missing', function (done) {
    // arrays to hold the responses that we would get from configAuditor
    let logs = []
    let errors = []
    // variable to hold what console.log originally did
    const logHolder = console.log
    const errorHolder = console.error
    // change console.log and console.error so that it does not print onto the screen and instead gives the data to the arrays
    console.log = function () {
      logs.push(arguments[1].toString('utf8'))
    }
    console.error = function () {
      errors.push(arguments[1].toString('utf8'))
    }

    // make the appDir folder
    fse.ensureDirSync(appDir)
    // add the package.json file to the appDir folder
    delete packageJSONSource.rooseveltConfig.modelsPath
    delete packageJSONSource.rooseveltConfig.viewsPath
    delete packageJSONSource.rooseveltConfig.controllersPath
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // use the configAuditor's audit method
    configAuditor.audit(appDir)

    console.error = errorHolder
    console.log = logHolder
    let test1 = logs[0].includes('Starting roosevelt user configuration audit...')
    let test2 = errors[0].includes('Missing param "modelsPath"!')
    let test3 = errors[1].includes('Missing param "viewsPath"!')
    let test4 = errors[2].includes('Missing param "controllersPath"!')
    let test5 = errors[3].includes('Issues have been detected in roosevelt config')
    let test6 = errors[4].includes('for the latest sample rooseveltConfig.')
    assert.equal(test1, true, 'Roosevelt did not start the configAuditor')
    assert.equal(test2, true, 'configAuditor did not report that the package.json file is missing a models path value')
    assert.equal(test3, true, 'configAuditor did not report that the package.json file is missing a views path value')
    assert.equal(test4, true, 'configAuditor did not report that the package.json file is missing a controllers path value')
    assert.equal(test5, true, 'configAuditor did not report that we had issues with the roosevelt config')
    assert.equal(test6, true, 'configAuditor did not report where a user can go to for examples of correct syntax and values')
    done()
  })

  it('should allow a user to run the configAuditor as a child process and get it to tell the user what params are missing from the package.json file', function (done) {
    // bool vars to hold whether or not the right logs and errors are being outputted
    let startingConfigAuditBool = false
    let modelsPathMissingBool = false
    let viewsPathMissingBool = false
    let controllersPathMissingBool = false
    let error1Bool = false
    let error2Bool = false

    // write the package.json file
    fse.ensureDirSync(appDir)
    delete packageJSONSource.rooseveltConfig.modelsPath
    delete packageJSONSource.rooseveltConfig.viewsPath
    delete packageJSONSource.rooseveltConfig.controllersPath
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // fork the configAuditor.js file and run it as a child process
    let testApp = fork(path.join(appDir, '../', '../', '../', '/lib', '/scripts', '/configAuditor.js'), [], {cwd: appDir, 'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    testApp.stderr.on('data', (data) => {
      if (data.includes('Missing param "modelsPath"!')) {
        modelsPathMissingBool = true
      }
      if (data.includes('Missing param "viewsPath"!')) {
        viewsPathMissingBool = true
      }
      if (data.includes('Missing param "controllersPath"!')) {
        controllersPathMissingBool = true
      }
      if (data.includes('Issues have been detected in roosevelt config')) {
        error1Bool = true
      }
      if (data.includes('for the latest sample rooseveltConfig.')) {
        error2Bool = true
      }
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'configAuditor did not start')
      assert.equal(modelsPathMissingBool, true, 'configAuditor did not report that the package.json file is missing a models path value')
      assert.equal(viewsPathMissingBool, true, 'configAuditor did not report that the package.json file is missing a views path value')
      assert.equal(controllersPathMissingBool, true, 'configAuditor did not report that the package.json file is missing a controllers path value')
      assert.equal(error1Bool, true, 'configAuditor did not report that we had issues with the roosevelt config')
      assert.equal(error2Bool, true, 'configAuditor did not report where a user can go to for examples of correct syntax and values')
      done()
    })
  })

  it('should not execute the configAuditor if the app already has a public folder in the app Directory', function (done) {
    // bool var to hold whether or not a specific log was given
    let startingConfigAuditBool = false

    // write the package.json file
    fse.ensureDirSync(appDir)
    delete packageJSONSource.rooseveltConfig.modelsPath
    delete packageJSONSource.rooseveltConfig.viewsPath
    delete packageJSONSource.rooseveltConfig.controllersPath
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // create a public folder inside the app Directory
    fse.ensureDir(path.join(appDir, 'public'))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // look at the logs
    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    // when the app finishes initialization, kill it
    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, false, 'Roosevelt ')
      done()
    })
  })

  it('should not start the audit if there is not a package.json file located in the test app Directory', function (done) {
    // bool var to hold whether or not the audit looked at the files
    let rooseveltAuditStartedBool = false

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // look at the logs to see if it would log out that the config audtior is starting
    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        rooseveltAuditStartedBool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(rooseveltAuditStartedBool, false, 'the config Auditor was still started even though there is no package.json file in the app Directory')
      done()
    })
  })

  it('should not start the audit if there is a package.json file located in the test app Directory but no rooseveltConfig property in it', function (done) {
    // bool var to hold whether or not the audit looked at the files
    let rooseveltAuditStartedBool = false

    // package.json source string
    packageJSONSource = {
      appDir: appDir,
      generateFolderStructure: true
    }

    // generate the package.json file
    fse.ensureDirSync(appDir)
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    // look at the logs to see if it would log out that the config audtior is starting
    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        rooseveltAuditStartedBool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(rooseveltAuditStartedBool, false, 'the config Auditor was still started even though there is no package.json file in the app Directory')
      done()
    })
  })

  it('should report that there are some properties that are missing or extra for some of the object params in the package.json file', function (done) {
    // bool var to hold whether the right logs were given
    let startingConfigAuditBool = false
    let error1Bool = false
    let error2Bool = false
    let missingEnableBool = false
    let missingWhiteListCSSBool = false
    let missingWhiteListJSBool = false
    let missingCompilerJSBool = false
    let extraWarningsJSBool = false

    // write the package.json file
    fse.ensureDirSync(appDir)
    delete packageJSONSource.rooseveltConfig.htmlValidator.enable
    delete packageJSONSource.rooseveltConfig.css.whitelist
    packageJSONSource.rooseveltConfig.js.warnings = true
    delete packageJSONSource.rooseveltConfig.js.compiler
    delete packageJSONSource.rooseveltConfig.js.whitelist
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stderr.on('data', (data) => {
      if (data.includes('Missing param "enable" in "htmlValidator"!')) {
        missingEnableBool = true
      }
      if (data.includes('Missing param "whitelist" in "css"!')) {
        missingWhiteListCSSBool = true
      }
      if (data.includes('Extra param "warnings" found in "js", this can be removed.')) {
        extraWarningsJSBool = true
      }
      if (data.includes('Missing param "compiler" in "js"!')) {
        missingCompilerJSBool = true
      }
      if (data.includes('Missing param "whitelist" in "js"!')) {
        missingWhiteListJSBool = true
      }
      if (data.includes('Issues have been detected in roosevelt config')) {
        error1Bool = true
      }
      if (data.includes('for the latest sample rooseveltConfig.')) {
        error2Bool = true
      }
    })

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the configAuditor')
      assert.equal(missingEnableBool, true, 'The config Auditor did not report that enable is missing from the htmlValidator param')
      assert.equal(missingWhiteListCSSBool, true, 'The config Auditor did not report that whitelist is missing from the CSS param')
      assert.equal(missingWhiteListJSBool, true, 'The config Auditor did not report that whitelist is missing from the JS param')
      assert.equal(extraWarningsJSBool, true, 'The config Auditor did not report that an extra param of warnings is in the JS param')
      assert.equal(missingCompilerJSBool, true, 'The config Auditor did not report that compiler is missing from the JS param')
      assert.equal(error1Bool, true, 'configAuditor did not report that we had issues with the roosevelt config')
      assert.equal(error2Bool, true, 'configAuditor did not report where a user can go to for examples of correct syntax and values')
      done()
    })
  })

  it('should report that there are extra params in the whole rooseveltConfig object', function (done) {
    // bool var to hold whether or not the correct logs are being outputted
    let extraTurboParamBool = false
    let extraMaxServersBool = false
    let error1Bool = false
    let error2Bool = false
    let startingConfigAuditBool = false

    // generate the package.json file
    fse.ensureDirSync(appDir)
    packageJSONSource.rooseveltConfig.turbo = true
    packageJSONSource.rooseveltConfig.maxServers = 4
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    testApp.stderr.on('data', (data) => {
      if (data.includes('Extra param "turbo" found, this can be removed.')) {
        extraTurboParamBool = true
      }
      if (data.includes('Extra param "maxServers" found, this can be removed.')) {
        extraMaxServersBool = true
      }
      if (data.includes('Issues have been detected in roosevelt config')) {
        error1Bool = true
      }
      if (data.includes('for the latest sample rooseveltConfig.')) {
        error2Bool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the config Auditor')
      assert.equal(extraTurboParamBool, true, 'config Auditor did not spot the extra turbo param in the rooseveltConfig')
      assert.equal(extraMaxServersBool, true, 'config Auditor did not sport the extra maxServers param in the rooseveltConfig')
      assert.equal(error1Bool, true, 'configAuditor did not report that we had issues with the roosevelt config')
      assert.equal(error2Bool, true, 'configAuditor did not report where a user can go to for examples of correct syntax and values')
      done()
    })
  })

  it('should report if the package.json contains script that run files from roosevelt and do not hold the up to date command', function (done) {
    // bool var to hold whether or not a specific log was outputted
    let cleanNotUpToDateBool = false
    let startingConfigAuditBool = false
    let error1Bool = false
    let error2Bool = false

    // generate the package.json file
    fse.ensureDirSync(appDir)
    packageJSONSource.scripts.clean = 'node ./node_modules/roosevelt/lib/scripts/appsCleanup.js'
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    testApp.stderr.on('data', (data) => {
      if (data.includes('Detected outdated script "clean". Update contents to "node ./node_modules/roosevelt/lib/scripts/appCleanup.js" to restore functionality.')) {
        cleanNotUpToDateBool = true
      }
      if (data.includes('Issues have been detected in roosevelt config')) {
        error1Bool = true
      }
      if (data.includes('for the latest sample rooseveltConfig.')) {
        error2Bool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(error1Bool, true, 'configAuditor did not report that we had issues with the roosevelt config')
      assert.equal(error2Bool, true, 'configAuditor did not report where a user can go to for examples of correct syntax and values')
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the config Auditor')
      assert.equal(cleanNotUpToDateBool, true, 'configAuditor did not report that one of its scripts is not up to date with what it should be')
      done()
    })
  })

  it('should report that there are no errors found if there are no errors', function (done) {
    // bool var to hold whether or not the right logs were outputted
    let startingConfigAuditBool = false
    let noErrorsBool = false

    // generate the package.json file
    fse.ensureDirSync(appDir)
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // generate the app.js file
    generateTestApp({
      appDir: appDir,
      onServerStart: `(app) => {process.send("something")}`
    }, options)

    // fork the app.js file and run it as a child process
    const testApp = fork(path.join(appDir, 'app.js'), {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
      if (data.includes('Configuration audit completed with no errors found.')) {
        noErrorsBool = true
      }
    })

    testApp.on('message', () => {
      testApp.kill('SIGINT')
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the config Auditor')
      assert.equal(noErrorsBool, true, 'config Auditor is reporting back that there is an error even though the package.json file does not have one')
      done()
    })
  })

  it('should not run the config Auditor if the file was forked and the wrong enviroment was passed to it', function (done) {
    // bool var to hold whether or not a specific log was outputted
    let startingConfigAuditBool = false

    // put a node_module in the test app directory
    fse.ensureDirSync(appDir)
    fse.mkdirSync(path.join(appDir, 'node_modules'))

    // set env.INIT_CWD to a location that does not have a node_module folder
    process.env.INIT_CWD = path.join(appDir, '../', 'util')

    // fork the configAuditor.js file and run it as a child process
    let testApp = fork(path.join(appDir, '../', '../', '../', '/lib', '/scripts', '/configAuditor.js'), [], {'cwd': appDir, 'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, false, 'Roosevelt started its config Auditor even when it was not suppose to')
      done()
    })
  })

  it('should be able to run even if a node modules folder is located in the test App Directory', function (done) {
    // bool var to hold whether or not the right logs were outputted
    let startingConfigAuditBool = false
    let noErrorsBool = false

    // generate the package.json file
    fse.ensureDirSync(appDir)
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // set env.INIT_CWD to the correct location
    process.env.INIT_CWD = appDir

    // create a node_modules folder
    fse.ensureDirSync(path.join(appDir, 'node_modules'))

    // fork the app.js file and run it as a child process
    let testApp = fork(path.join(appDir, '../', '../', '../', '/lib', '/scripts', '/configAuditor.js'), [], {'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
      if (data.includes('Configuration audit completed with no errors found.')) {
        noErrorsBool = true
      }
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the config Auditor')
      assert.equal(noErrorsBool, true, 'config Auditor is reporting back that there is an error even though the package.json file does not have one')
      done()
    })
  })

  it('should choose one of the enviroment vars if both of the ones that we are looking at are the same', function (done) {
    // bool var to see if the right logs are being logged
    let startingConfigAuditBool = false
    let noErrorsBool = false

    // set env.INIT_CWD to the correct location
    process.env.INIT_CWD = appDir

    // generate the package.json file
    fse.ensureDirSync(appDir)
    fse.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJSONSource))

    // fork the app.js file and run it as a child process
    let testApp = fork(path.join(appDir, '../', '../', '../', '/lib', '/scripts', '/configAuditor.js'), [], {'cwd': appDir, 'stdio': ['pipe', 'pipe', 'pipe', 'ipc']})

    testApp.stdout.on('data', (data) => {
      if (data.includes('Starting roosevelt user configuration audit...')) {
        startingConfigAuditBool = true
      }
      if (data.includes('Configuration audit completed with no errors found.')) {
        noErrorsBool = true
      }
    })

    testApp.on('exit', () => {
      assert.equal(startingConfigAuditBool, true, 'Roosevelt did not start the config Auditor')
      assert.equal(noErrorsBool, true, 'config Auditor is reporting back that there is an error even though the package.json file does not have one')
      done()
    })
  })
})
