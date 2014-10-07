
var express       = require( 'express' );
var request       = require( 'request' );
var _             = require( 'underscore' );
var querystring   = require( 'querystring' );
var cookieParser  = require( 'cookie-parser' );
var fs            = require( 'fs');
var util          = require( 'util' );

var app           = JSON.parse( fs.readFileSync( 'app.json', { "encoding":"UTF-8" }));
var client_id     = app['client']['id'];
var client_secret = app['client']['secret'];
var redirect_uri  = app['client']['redirect_uri'];
var stateKey      = 'spotify_auth_state';
var scope         = 'user-read-private user-read-email playlist-read-private';
var app           = express();


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function( length ) {
  var text     = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};


var redirect = function( res, url, params ) {
  res.redirect( url + querystring.stringify( params ));
}


var param = function( req, name ){
  return req.query[ name ] || null;
}


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


var send_zip_response = function( res, file_name, content ) {
  // http://stackoverflow.com/a/25210806/472153
  res.writeHead( 200, { 'Content-Type':        'application/zip',
                        'Content-disposition': 'attachment; filename="' + file_name + '.zip"' });
  var archiver = require( 'archiver' );
  var zip      = archiver( 'zip' );
  zip.pipe( res );
  zip.append( content, { name: file_name + '.json' }).finalize();
}


var export_playlist = function( res, token, playlist_name, tracks_url, all_tracks ) {

  if ( tracks_url != null ) {
    console.log( util.format( "Reading [%s]", tracks_url ))
  } else {
    console.log( util.format( "Sending playlist '%s' with %s tracks", playlist_name, all_tracks.length ))
  }

  if ( tracks_url === null ) {
    // Pagination is over
    var playlist_json = JSON.stringify({ 'name': playlist_name, 'tracks': all_tracks }, null, '  ' );
    send_zip_response( res, playlist_name, playlist_json );
  } else {
    // Pagination continues
    get( token, tracks_url, function( response ){
      response = JSON.parse( response );
      tracks   = _.map( response.items, function( item ){ return {
        'artists': _.map( item.track.artists, function( artist ){ return artist.name }).join( ', ' ),
        'album'  : item.track.album.name,
        'name'   : item.track.name
      }})

      export_playlist( res, token, playlist_name, response.next, all_tracks.concat( tracks ))
    })
  }
}


app.use( express.static( __dirname + '/public' )).use( cookieParser());


app.get( '/login', function( req, res ) {

  var state = generateRandomString( 16 );
  res.cookie( stateKey, state );

  redirect( res, 'https://accounts.spotify.com/authorize?', {
    response_type: 'code',
    client_id:     client_id,
    scope:         scope,
    redirect_uri:  redirect_uri,
    state:         state
  });
});


app.get( '/callback', function( req, res ) {

  var code        = req.query.code  || null;
  var state       = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (( state === null ) || ( state !== storedState )) {
    redirect( res, '/#', { error: 'state_mismatch' });
  } else {
    res.clearCookie( stateKey );
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code:          code,
        redirect_uri:  redirect_uri,
        grant_type:    'authorization_code',
        client_id:     client_id,
        client_secret: client_secret
      },
      json: true
    };

    request.post( authOptions, function( error, response, body ) {
      if (( ! error ) && ( response.statusCode === 200 )) {

        var access_token  = body.access_token,
            refresh_token = body.refresh_token;

        // we can also pass the token to the browser to make requests from there
        redirect( res, '/#', { access_token: access_token, refresh_token: refresh_token });
      } else {
        redirect( res, '/#', { error: 'invalid_token' });
      }
    });
  }
});


app.get( '/export', function( req, res ) {

  var token         = param( req, 'token'  );
  var playlist_name = param( req, 'name'   );
  var tracks_url    = param( req, 'tracks' );

  if (( token === null ) || ( playlist_name === null ) || ( tracks_url === null )) {
    console.log( util.format( "Missing parameters: token = [%s], playlist name = [%s], tracks URL = [%s]",
                              token, playlist_name, tracks_url ));
    res.send( 'Error' );
    return;
  }

  export_playlist( res, token, playlist_name, tracks_url, [] )
});


console.log( 'http://127.0.0.1:8080' );
app.listen( 8080 );
