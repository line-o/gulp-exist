/**
 * an example gulpfile to make ant-less existdb package builds a reality
 */
const { src, dest, watch, series, parallel, lastRun } = require('gulp')
const { createClient } = require('@existdb/gulp-exist')

const del = require('delete')
const zip = require('gulp-zip')
const replace = require('@existdb/gulp-replace-tmpl')
const rename = require('gulp-rename')

const sass = require('gulp-sass')
const uglify = require('gulp-uglify-es').default

const { version, license } = require('./package.json')

// read metadata from .existdb.json
const existJson = require('./.existdb.json')
const replacements = [existJson, {version, license}]

const serverInfo = existJson.servers.localhost

const target = serverInfo.root
const { port, hostname } = new URL(serverInfo.server)
const connectionOptions = {
    basic_auth: {
        user: serverInfo.user, 
        pass: serverInfo.password
    },
    host: hostname,
    port
}
const existClient = createClient(connectionOptions)

/**
 * Use the `delete` module directly, instead of using gulp-rimraf
 */
function clean (cb) {
  del(['build'], cb)
}
exports.clean = clean


/**
 * replace placeholders
 * in src/repo.xml.tmpl and
 * output to build/repo.xml
 */
function templates () {
  return src('src/*.tmpl')
    .pipe(replace(replacements))
    .pipe(rename(path => { path.extname = '' }))
    .pipe(dest('build/'))
}
exports.templates = templates

function watchTemplates () {
  watch('src/*.tmpl', series(templates))
}
exports['watch:tmpl'] = watchTemplates

/**
 * compile SCSS styles and put them into 'build/app/css'
 */
function styles () {
  return src('src/scss/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(dest('build/css'))
}
exports.styles = styles

function watchStyles () {
  watch('src/scss/**/*.scss', series(styles))
}
exports['watch:styles'] = watchStyles

/**
 * minify EcmaSript files and put them into 'build/app/js'
 */
function minifyEs () {
  return src('src/js/**/*.js')
    .pipe(uglify())
    .pipe(dest('build/js'))
}
exports.minify = minifyEs

function watchEs () {
  watch('src/js/**/*.js', series(minifyEs))
}
exports['watch:es'] = watchEs

const staticGlob = 'src/**/*.{xml,html,xq,xquery,xql,xqm,xsl,xconf}'

/**
 * copy html templates, XSL stylesheet, XMLs and XQueries to 'build'
 */
function copyStatic () {
  return src(staticGlob).pipe(dest('build'))
}
exports.copy = copyStatic

function watchStatic () {
  watch(staticGlob, series(copyStatic))
}
exports['watch:static'] = watchStatic

/**
 * Upload all files in the build folder to existdb.
 * This function will only upload what was changed
 * since the last run (see gulp documentation for lastRun).
 */
function deploy () {
  return src('build/**/*', {
    base: 'build',
    since: lastRun(deploy)
  })
    .pipe(existClient.dest({ target }))
}

function watchBuild () {
  watch('build/**/*', series(deploy))
}

// construct the current xar name from available data
const packageName = () => `${existJson.package.target}-${version}.xar`

/**
 * create XAR package in repo root
 */
function xar () {
  return src('build/**/*', { base: 'build' })
    .pipe(zip(packageName()))
    .pipe(dest('.'))
}

/**
 * upload and install the latest built XAR
 */
async function installXar () {
  return src(packageName())
    .pipe(existClient.install())
}

// composed tasks
const build = series(
  clean,
  styles,
  minifyEs,
  templates,
  copyStatic
)
const watchAll = parallel(
  watchStyles,
  watchEs,
  watchStatic,
  watchTemplates,
  watchBuild
)

exports.build = build
exports.watch = watchAll

exports.deploy = series(build, deploy)
exports.xar = series(build, xar)
exports.install = series(build, xar, installXar)

// main task for day to day development
exports.default = series(build, deploy, watchAll)
