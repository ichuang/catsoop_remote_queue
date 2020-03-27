const spawn = require('child_process').spawn;
const spawnSync = require('child_process').spawnSync;
const path = require('path');

const del = require('del');

const gulp = require('gulp');
const autoprefixer = require('gulp-autoprefixer');
const babel = require("gulp-babel");
const changed = require("gulp-changed");
const rename = require('gulp-rename');
const sass = require("gulp-sass");
const webpack = require('webpack-stream');

let params = require('./config/params');

function onError(err) {
    console.log(err);
    this.emit('end');
}

gulp.task('clean-www', () => {
    return del.sync('dist/www');
});

gulp.task('clean-server', () => {
    return del.sync('dist/server');
});

gulp.task('clean-config', () => {
    return del.sync('dist/config');
});

gulp.task('clean-catsoop', () => {
    return del.sync('dist/catsoop');
});


gulp.task('clean', ['clean-server', 'clean-config', 'clean-www', 'clean-catsoop'], () => {
    return del.sync('dist');
});

gulp.task('build-www-js', () => {
    return gulp.src('www/js/*.js')
               .pipe(webpack({
                   entry: './www/js/queue.js',
                   module: {
                       loaders: [
                           {test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/},
                           {test: /\.html$/, loader: 'ractive'},
                       ],
                   },
               }))
               .on('error', onError)
               .pipe(rename({basename: 'queue'}))
               .pipe(gulp.dest('dist/www/js'))
});

gulp.task('build-www', ['build-www-js'], () => {
    js_includes = [
        path.join('bootstrap', 'dist', 'js', 'bootstrap.js'),
        path.join('jquery', 'dist', 'jquery.js'),
    ].map(p => path.join(__dirname, 'bower_components', p))
     .concat([
         'queue-onload-staff.js',
         'queue-onload-student.js',
     ].map(p => path.join(__dirname, 'www', 'js')));

    js_includes.push('www/js/queue-onload-staff.js');
    js_includes.push('www/js/queue-onload-student.js');

    font_includes = [
        path.join('bootstrap-sass', 'assets', 'fonts', '**/*'),
    ].map(p => path.join(__dirname, 'node_modules', p));


    return Promise.all([
        gulp.src('www/index.html')
            .pipe(changed('dist/www/'))
            .pipe(gulp.dest('dist/www/')),

        gulp.src('www/images/*')
            .pipe(changed('dist/www/images'))
            .pipe(gulp.dest('dist/www/images')),

        gulp.src('www/audio/*')
            .pipe(changed('dist/www/audio'))
            .pipe(gulp.dest('dist/www/audio')),

        gulp.src('www/scss/**/*.scss')
            .pipe(sass({includePaths: [path.join(__dirname, 'node_modules')]}).on('error', sass.logError))
            .pipe(autoprefixer({browsers: ['last 2 versions']}))
            .pipe(gulp.dest('dist/www/css')),

        gulp.src(js_includes)
            .pipe(changed('dist/www/js'))
            .pipe(gulp.dest('dist/www/js')),

        gulp.src(font_includes)
            .pipe(changed('dist/www/fonts'))
            .pipe(gulp.dest('dist/www/fonts')),
    ]);
});

gulp.task('build-config', () => {
    return gulp.src('config/*')
        .pipe(changed('dist/config'))
        .pipe(gulp.dest('dist/config'));
});

gulp.task('build-server', () => {
    return gulp.src('server/*')
        .pipe(changed('dist/server'))
        .pipe(gulp.dest('dist/server'));
});

gulp.task('build-catsoop', ['clean-catsoop'], () => {
    return new Promise((resolve, reject) => {
        spawn('./scripts/make_catsoop.py', [
            JSON.stringify(params),
            'dist/catsoop',
        ], {stdio: 'inherit'})
            .on('exit', (code, signal) => {
                if (signal) reject(signal);
                if (code !== 0) reject(`make_catsoop.py failed with exit code ${code}`);
                resolve();
            });
    });
});

gulp.task('build', [
    'build-server',
    'build-config',
    'build-www',
    'build-catsoop',
], () => Promise.resolve());

var db;
gulp.task('run-db', [], () => {
    if (db) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        process.stdout.write(`Spawning rethinkdb...\n`);
        db = spawn('rethinkdb',
                   [
                       '--port-offset', params.RETHINKDB.PORT_OFFSET || 0,
                   ],
                   {stdio: 'pipe'});
	if (1){
	    setTimeout(function(){
                process.stdout.write(`Timed out waiting for DB ready, going ahead anyway!\n`);
                spawn('./scripts/db_setup.js', {stdio: 'inherit'})
                    .on('exit', (code, signal) => {
                        if (signal) reject(signal);
                        if (code !== 0) reject(`make_catsoop.py failed with exit code ${code}`);
			process.stdout.write("DB started!");
                        resolve();
                    });
	    }, 8000);
	}
        db.stdio[1].on('data', data => {
            data.toString().split('\n').forEach(line => {
                if (!line) return;

                process.stdout.write(`DB: ${line}\n`);
                if (/^Server ready/.test(line)) {
                    process.stdout.write(`Got DB server ready!\n`);
                    spawn('./scripts/db_setup.js', {stdio: 'inherit'})
                        .on('exit', (code, signal) => {
                            if (signal) reject(signal);
                            if (code !== 0) reject(`make_catsoop.py failed with exit code ${code}`);
                            resolve();
                        });
                }
            })
        });
    });
});

var server;
gulp.task('run-server', ['build-server', 'run-db'], () => {
    if (server) {
        server.kill();
    }
    server = spawn('node', ['dist/server/index.js'], {stdio: 'inherit'});
    server.on('close', (code) => {
        if (code === 8) {
            gulp.log('Error detected, waiting for changes...');
        }
    });
});

process.on('exit', function() {
    if (server) {
        server.kill();
    }

    if (db) {
        db.kill();
    }
});

gulp.task('reload-config', () => {
    delete require.cache[require.resolve('./config/params')];
    params = require('./config/params');
});

gulp.task('start', ['clean', 'build', 'run-server'], () => {
    gulp.watch(['www/**/*', 'imports/*'], ['build-www']);
    gulp.watch(['server/*'], ['run-server']);
    gulp.watch(['catsoop/*'], ['build-catsoop']);
    gulp.watch(['config/*'], ['reload-config', 'build', 'run-server']);
});

gulp.task('default', ['clean', 'build', 'run-server'], () => {});
