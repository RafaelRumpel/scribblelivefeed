/* file: gulpfile.js */

var gulp = require('gulp');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');

gulp.task('build-css', function () {
  return gulp.src('./styles/**/*.scss')
    .pipe(sourcemaps.init())  // Process the original sources
      .pipe(sass())
    .pipe(sourcemaps.write()) // Add the map to modified source.
    .pipe(gulp.dest('./build/css'));
});

gulp.task('jshint', function () {
  return gulp.src('./scripts/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('build-js', function () {
  return gulp.src('./scripts/**/*.js')
    .pipe(sourcemaps.init())
      .pipe(concat('scribblelivefeed.js'))
      //only uglify if gulp is ran with '--type production'
      .pipe(gutil.env.type === 'production' ? uglify() : gutil.noop())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./build/js'));
});

// configure which files to watch and what tasks to use on file changes
gulp.task('watch', function () {
  gulp.watch('./scripts/**/*.js', ['jshint']);
  gulp.watch('./scripts/**/*.js', ['build-js']);
  gulp.watch('./styles/**/*.scss', ['build-css']);
});

// define the default task and add the watch task to it
gulp.task('default', ['jshint', 'build-js', 'build-css']);
