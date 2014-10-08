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
 * @param {res}           response to send ZIP to
 * @param {token}         access token
 * @param {playlist_name} name of the playlist
 * @param {playlist_url}  playlist URL to open in a Web player
 * @param {tracks_url}    URL to fetch playlist tracks
 * @param {tracks}        Array of playlist tracks, accumulated so far
 */
exports.export_playlist = function( res, token, playlist_name, playlist_url, tracks_url, tracks ) {

  if ( tracks_url === null ) {
    // Pagination is over, no more tracks to fetch
    console.log( util.format( "Sending playlist '%s' with %s tracks", playlist_name, tracks.length ))
    var playlist = JSON.stringify({
      'name':   playlist_name,
      'url':    playlist_url,
      'tracks': tracks
    }, null, '  ' );
    send_zip_response( res, playlist_name, playlist );
  } else {
    // Pagination continues, there are more tracks to fetch
    console.log( util.format( "Reading [%s]", tracks_url ))
    get( token, tracks_url, function( response ){
      response = JSON.parse( response );
      // https://developer.spotify.com/web-api/get-playlists-tracks/
      var new_tracks = _.map( response.items, function( item ){ return {
        'artists': _.map( item.track.artists, function( artist ){ return artist.name }).join( ', ' ),
        'album'  : item.track.album.name,
        'name'   : item.track.name
      }})

      exports.export_playlist( res, token, playlist_name, playlist_url, response.next, tracks.concat( new_tracks ))
    })
  }
}


/**
 * Makes a GET request to Spotify Web API.
 * @param {access_token} access token to authorize the request with
 * @param {url}          URL to send the request to
 * @param {handler}      callback function to invoke when response is successful, it is passed a response body when called
 */
var get = function( access_token, url, handler ) {

  // https://www.npmjs.org/package/request

  request.get( url,
               { headers: { 'Authorization': 'Bearer ' + access_token }},
               function( error, response, body ){
    if (( ! error ) && ( response.statusCode === 200 )) {
      handler( body )
    } else {
      console.log( "Failed to send GET request to '" + url + "', status code is " + response.statusCode )
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
