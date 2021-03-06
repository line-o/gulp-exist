# gulp-exist

[![version](https://img.shields.io/npm/v/@existdb/gulp-exist.svg)](https://www.npmjs.com/package/@existdb/gulp-exist) [![travis-ci](https://api.travis-ci.com/eXist-db/gulp-exist.png)](https://travis-ci.com/eXist-db/gulp-exist) [![windows ci](https://ci.appveyor.com/api/projects/status/wcbi1e0yx47prhl6?svg=true)](https://ci.appveyor.com/project/olvidalo/gulp-exist)


> A gulp plugin to deploy to and query an eXist-db using eXist's XML-RPC API.

## Usage

`gulp deploy` will store all files in the ```build``` directory to
**/db/apps/myapp** collection in eXist.

```js
const gulp = require('gulp'),
    exist = require('@existdb/gulp-exist')

// authenticate against eXist
const connectionOptions = {
    basic_auth: {
        user: "admin",
        pass: ""
    }
}

const exClient = exist.createClient(connectionOptions)

// deploy all
function deploy () {
    return gulp.src('**/*', {cwd: 'build'})
        .pipe(exClient.dest({target: '/db/apps/myapp/'})
}

exports.default = deploy
```

NOTE: Non-existing collections and sub-folders will be created automatically.

### exist.createClient(options)

Returns a set of functions to interact with an eXist-db instance.
What you can do is dependent on the permissions of the user specified
in the connection options.

NOTE: The connection options are passed through to the XMLRPC client
library.
So it might be possible to use different authentication methods or
to pass in more options than mentioned below as long as your eXist-db
installation understands them.

#### Options

##### host

Type: `string`
Default: `'localhost'`

##### port

Type: `number`
Default: `8080`

##### path

Path to eXist's XML-RPC endpoint

Type: `string`
Default: `'/exist/xmlrpc'`

##### basic_auth

The credentials used to authenticate requests.
What you can and cannot do depends on the permissions
this user has.

Type: `Object`
Default: ```{ user: 'guest', pass: 'guest' }```

##### secure

Use HTTPS to connect to the database instance.
Needs a valid certificate installed in the keystore of
exist.

Type: `Boolean`
Default: `false`

#### Example

```js
const exClient = exist.createClient()
```

### existClient.dest(options)

Uploads input files to a target collection in eXist.

#### Options

##### target

Remote deployment target collection. Non-existent collections will be created.

Type: `string`
Default `'/db'`

##### html5AsBinary

When set to true, any HTML file that cannot be
parsed as valid XML, will be uploaded as a binary file instead.
HTML5 documents tend to be non well-formed XML.

Formerly `binary_fallback`.
NOTE: Binary documents can not be indexed and therefore are also not
searchable by the eXist-db. This option is only useful for template files.

Type: `boolean`
Default: `false`

##### permissions

Specify remote permissions for files as path-permission pairs.

Type: `Object{path: permissions}`
Default: `{}`

```js
{
    '.secrets/key':   'rwx------',
    'controller.xql': 'rwxr-xr-x'
}
```

#### Example

```js
const gulp = require('gulp'),
    exist = require('@existdb/gulp-exist')

// override defaults
const connectionOptions = {
    basic_auth: {
        user: 'admin',
        pass: ''
    }
}

const exClient = exist.createClient(connectionOptions)

function deployWithPermissions () {
    return gulp.src('**/*', {cwd: '.'})
        .pipe(exClient.dest({
            target: '/db/apps/myapp/',
            permissions: { 'controller.xql': 'rwxr-xr-x' }
        }))
}

exports.default = deployWithPermissions
```

### existClient.newer(options)

Filters the input stream for files that are newer than their remote counterpart.

#### Options

##### target

Which collection to compare the local files to.

#### Example

Only upload modified files.

```js
const gulp = require('gulp'),
    exist = require('@existdb/gulp-exist')

// override defaults
const connectionOptions = {
    basic_auth: {
        user: 'admin',
        pass: ''
    }
}

const exClient = exist.createClient(connectionOptions)
const targetOptions = {
    target: '/db/apps/myapp/',  // the collection to write
    html5AsBinary: true         // upload HTML5 templates as binary
}

function deployNewer () {
	return gulp.src('**/*', {cwd: '.'})
		.pipe(exClient.newer(targetOptions))
		.pipe(exClient.dest(targetOptions));
}

exports.default = deployNewer
```

### existClient.query(options)

Execute input files as XQuery on the server.

The input files will not be stored in eXist but read locally and executed directly. The query results will be logged in the console (can be disabled by setting ```printXqlResults``` to ```false```). For each input file, the result of the query will also be emitted as an output file that can optionally be copied into a local directory for logging. Timestamps will be appended to the filename. The filename extension of the output files can be controlled with ```xqlOutputExt``` (default is ```xml```).

#### Query options

##### printXqlResults

Whether to print the results of executed XQuerys to console.

Type: `boolean`
Default: `true`

##### xqlOutputExt

The filename extension that will be used for XQuery result files emitted by ```exist.query()```.
Possible values: 'xml' or 'json'.

Type: `string`
Default: `'xml'`

#### Example

Upload a collection index configuration file and re-index the collection

*```scripts/reindex.xq```*

```xquery
xquery version "3.1";
declare option exist:serialize "method=json media-type=text/javascript";
<result>
	<success>{xmldb:reindex('/db/apps/myapp/data')}</success>
</result>
```

*```gulpfile.js```*

```js
const gulp = require('gulp'),
    exist = require('@existdb/gulp-exist')

// override defaults
const connectionOptions = {
    basic_auth: {
        user: "admin",
        pass: ""
    }
}

const exClient = exist.createClient(connectionOptions)

const queryConfig = {
	target: '/db/apps/myapp',
	xqlOutputExt: 'json'
}

function deployCollectionXConf () {
	return gulp.src('collection.xconf', {cwd: '.'})
		.pipe(exClient.dest({
            target: '/db/system/config/db/apps/myapp/data'
        }))
}

// optional store the query result locally in logs
function reindex () {
	return gulp.src('scripts/reindex.xq', {cwd: '.'})
		.pipe(exClient.query(queryConfig))
        .pipe(gulp.dest('logs')) 
}

exports.default = gulp.series(deployCollectionXConf, reindex)
```

## Define Custom Mime Types

Override the mime type used to store files in exist based on their extension.
`defineMimeTypes` just exposes `mime.define()`.
*NOTE:* attempt to redefine a registered **extension** will throw an error.

Extended by default:
`{
    'application/xquery': ['xq', 'xquery', 'xqs', 'xql', 'xqm'],
    'application/xml': ['xconf', 'odd']
}`

Type: `Object {mimetype: [extensions]}`

##### Example

```js
exist.defineMimeTypes({ 'text/foo': ['bar'] })
```

## More examples

### Watch

```gulp watch``` will automatically upload files on change

```js

const gulp = require('gulp'),
    exist = require('@existdb/gulp-exist'),
    sass = require('gulp-sass'),
    watch = require('gulp-watch'),
    newer = require('gulp-newer');

const exClient = exist.createClient({ /* some configuration */});

// compile SCSS styles and put them into 'build/app/css'
gulp.task('styles', function() {
    return gulp.src('app/scss/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('build/app/css'));
});

// copy html templates, XMLs and XQuerys to 'build'
gulp.task('copy', function() {
    return gulp.src('app/**/*.{xml,html,xql,xqm,xsl,rng}')
            .pipe(newer('build'))
            .pipe(gulp.dest('build'))
});


gulp.task('deploy',  function() {
    return gulp.src('build/**/*', {base: 'build'})
        .pipe(exClient.newer({target: "/db/apps/myapp"}))
        .pipe(exClient.dest({target: "/db/apps/myapp"}));
});

gulp.task('watch-styles', function() {
    gulp.watch('app/scss/**/*.scss', gulp.series('styles'))
});

gulp.task('watch-copy', function() {
    gulp.watch([
                'app/js/**/*',
                'app/imgs/**/*',
                'app/**/*.{xml,html,xql,xqm,xsl}'
                ],  
                gulp.series('copy'));
});

gulp.task('watch-deploy', function() {
    gulp.watch('build/**/*', gulp.series('deploy'));
});

gulp.task('watch', gulp.parallel('watch-styles', 'watch-copy', 'watch-deploy'));

```

### Make XAR Archive

```js

const gulp = require('gulp'),
    exist = require('@existdb/gulp-exist'),
    zip = require('gulp-zip')

gulp.task('build', function{} {
    // compile everything into the 'build' directory
});

gulp.task('xar', gulp.series('build', function() {
    const pkg = require('./package.json');

    return gulp.src('build' + '**/*', {base: 'build'})
            .pipe(zip(`${pkg.abbrev}-${pkg.version}.xar`))
            .pipe(gulp.dest("."));
}));

```

## Test

### Prerequisites

A running instance of eXist-db v2.2+ at localhost port 8080 with an
admin user that has a blank password.

### Run the Tests

    npm test
