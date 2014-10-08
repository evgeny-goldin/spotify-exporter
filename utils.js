"use strict";

var request       = require( 'request' );
var _             = require( 'underscore' );
var querystring   = require( 'querystring' );
var util          = require( 'util' );


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
exports.randomString = function( length ) {

  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГДейка';
  var text     = _.times( length, function(){ return possible.charAt( Math.floor( Math.random() * possible.length )) }).
                 join( '' );

  return text;
};


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
 * Exports a playlist specified by sending it in a ZIP response.
 * @param {res}          response to send ZIP to
 * @param {token}        access token
 * @param {user_id}      user ID of playlist owner
 * @param {playlist_id}  playlist ID
 */
exports.export_playlist = function( res, token, user_id, playlist_id ) {

  // https://developer.spotify.com/web-api/get-playlist/

  get( token,
       util.format( 'https://api.spotify.com/v1/users/%s/playlists/%s', user_id, playlist_id ),
       function( response ){

    var d    = new Date();
    var date = util.format( "%s/%s/%s at %s:%s:%s", d.getDate(),  d.getMonth() + 1, d.getFullYear(),
                                                    d.getHours(), d.getMinutes(),   d.getSeconds());
    var playlist = {
      'start'    : d.getTime(),
      'exported' : date,
      'name'     : response.name,
      'url'      : response.external_urls.spotify,
      'owner'    : response.owner.id,
      'tracks'   : read_tracks( response.tracks.items )
    }

    export_playlist_paginate( res, token, playlist, response.tracks.next );
  });
}


/**
 * Exports a playlist specified by sending it in a ZIP response, paginating over all tracks.
 * @param {res}        response to send ZIP to
 * @param {token}      access token
 * @param {playlist}   playlist JSON
 * @param {tracks_url} URL to read playlist tracks from, null when pagination is over
 */
var export_playlist_paginate = function( res, token, playlist, tracks_url ) {

  if ( tracks_url === null ) {
    // Pagination is over, no more tracks to fetch
    var fetch_duration = new Date().getTime() - playlist.start;
    playlist.start     = undefined;
    console.log( util.format( "%s tracks of playlist '%s' fetched in %s ms",
                              playlist.tracks.length, playlist.name, fetch_duration ))
    send_zip_response( res, playlist.name, JSON.stringify( playlist, null, '  ' ));
  } else {
    // Pagination continues, there are more tracks to fetch
    get( token, tracks_url, function( response ){
      playlist.tracks = playlist.tracks.concat( read_tracks( response.items ))
      export_playlist_paginate( res, token, playlist, response.next )
    })
  }
}


/**
 * Reads playlist tracks.
 * @param  {track_items} "items" tracks section of Spotify response JSON
 * @return {array} tracks as array of JSONs, each JSON specifying track's uri, name, etc.
 */
var read_tracks = function ( track_items ) {
  // https://developer.spotify.com/web-api/get-playlists-tracks/
  return _.map( track_items, function( item ){
    var track = item.track;
    return {
      'uri'     : track.uri,
      'preview' : track.preview_url,
      'name'    : track.name,
      'album'   : track.album.name,
      'artists' : _.map( track.artists, function( artist ){ return artist.name }).join( ', ' ),
      'duration': duration( track.duration_ms )
    }
  })
}


/**
 * Retrieves track duration as "mm:ss".
 * @param  {duration_ms}  track duration in milliseconds
 * @return {string} track duration as "mm:ss"
 */
var duration = function( duration_ms ) {
  var millis_in_second = 1000;
  var millis_in_minute = millis_in_second * 60;
  var minutes          = Math.floor( duration_ms / millis_in_minute );
  var seconds          = Math.ceil(( duration_ms - ( minutes * millis_in_minute )) / millis_in_second );
  var pad              = function ( n ){ return (( n < 10 ? '0' : '' ) + n )}

  return util.format( "%s:%s", pad( minutes ), pad( seconds ));
}


/**
 * Makes a GET request to Spotify Web API.
 * @param {access_token} access token to authorize the request with
 * @param {url}          URL to send the request to
 * @param {handler}      callback function to invoke when response is successful, it is passed a response body when called
 */
var get = function( access_token, url, handler ) {

  console.log( util.format( "GET: [%s]", url ));

  // https://www.npmjs.org/package/request

  request.get( url,
               { headers: { 'Authorization': 'Bearer ' + access_token }, json: true },
               function( error, response, body ){
    if (( ! error ) && ( response.statusCode === 200 )) {
      handler( body )
    } else {
      console.log( util.format( "Failed to send GET request to '%s', status code is %s", url, response.statusCode ))
      if ( error ){ console.log( error ) }
      console.log( body )
    }
  });
}


/**
 * Sends a ZIP response with content provided.
 * @param {res}       response to send ZIP to
 * @param {file_name} name of the file to create in a ZIP
 * @param {content}   String content to store in a file
 */
var send_zip_response = function( res, file_name, content ) {
  // http://stackoverflow.com/a/25210806/472153
  res.writeHead( 200, { 'Content-Type':        'application/zip',
                        'Content-disposition': 'attachment; filename="' + file_name + '.zip"' });
  var archiver = require( 'archiver' );
  var zip      = archiver( 'zip' );
  zip.pipe( res );
  zip.append( content, { name: file_name + '.json' }).finalize();
}