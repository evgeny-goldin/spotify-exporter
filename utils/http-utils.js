"use strict";

var _           = require( 'underscore' );
var util        = require( 'util' );
var request     = require( 'request' );
var querystring = require( 'querystring' );
var archiver    = require( 'archiver' );
var API_ROOT    = 'https://api.spotify.com/v1'


/**
 * Redirects response to URL specified.
 * @param {res}    response to redirect
 * @param {url}    URL to redirect response to
 * @param {params} parameters to add to redirect
 */
exports.redirect = function( res, url, params ) {
  res.redirect( url + querystring.stringify( params ));
}


/**
 * Retrieves parameter specified fropm request provided.
 * @param {req}     request to read the parameter from
 * @param {name}    parameter name to read
 * @return {string} parameter value or null, if not found
 */
exports.param = function( req, name ){
  return req.query[ name ] || null;
}


/**
 * Retrieves a URL for Spotify API call to read user's playlists.
 * @param {user_id} Spotify user ID
 * @return {string} URL for Spotify API call to read user's playlists
 */
exports.user_playlists_url = function( user_id ) {
  return util.format( '%s/users/%s/playlists', API_ROOT, user_id );
}


/**
 * Retrieves a URL for Spotify API call to read a playlist.
 * @param  {user_id}     Spotify user ID
 * @param  {playlist_id} Spotify playlist ID
 * @return {string}      URL for Spotify API call to read a playlist
 */
exports.playlist_url = function( user_id, playlist_id ) {
  return util.format( '%s/users/%s/playlists/%s', API_ROOT, user_id, playlist_id );
}


/**
 * Makes a GET request to Spotify Web API.
 * @param {token}    access token to authorize the request with
 * @param {url}      URL to send the request to
 * @param {callback} callback function to invoke when response is successful, it is passed a response body when called
 */
exports.get = function( token, url, callback ) {

  // console.log( "GET: [%s]", url );
  // https://www.npmjs.org/package/request

  request.get( url,
               { headers: { 'Authorization': 'Bearer ' + token }, json: true },
               function( error, response, body ){
    if (( ! error ) && ( response.statusCode === 200 )) {
      callback( body )
    } else {
      console.trace( "Failed to send GET request to '%s'", url )
      if ( error                           ){ console.log( error ) }
      if ( response && response.statusCode ){ console.log( "Status code is %s", response.statusCode ) }
      console.log( body );
    }
  });
}


/**
 * Sends a ZIP response with content provided.
 * @param {res}              response to send ZIP to
 * @param {export_playlists} export playlists to send
 */
exports.send_zip_response = function( res, export_playlists ) {

  var archive_name = ( export_playlists.length == 1 ? export_playlists[0].name : 'playlists' ) + '.zip';
  console.log( "Sending '%s' with %s playlist%s",
               archive_name, export_playlists.length, ( export_playlists.length == 1 ? '' : 's' ))

  // http://stackoverflow.com/a/25210806/472153
  res.writeHead( 200, { 'Content-Type':        'application/zip',
                        'Content-disposition': 'attachment; filename="' + archive_name + '"' });
  var zip = archiver( 'zip' );
  zip.pipe( res );

  _.each( export_playlists, function( export_playlist ){
    zip.append( JSON.stringify( export_playlist, null, '  ' ),
                { name: export_playlist.name + '.json' });
  });

  zip.finalize();
}
