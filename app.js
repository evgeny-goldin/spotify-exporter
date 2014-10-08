"use strict";

var express       = require( 'express' );
var fs            = require( 'fs');
var request       = require( 'request' );
var cookieParser  = require( 'cookie-parser' );
var util          = require( 'util' );
var u             = require( './utils' );

var app           = express();
var app_data      = JSON.parse( fs.readFileSync( 'app.json', { "encoding":"UTF-8" }));
var client_id     = app_data['client']['id'];
var client_secret = app_data['client']['secret'];
var redirect_uri  = app_data['client']['redirect_uri'];
var stateKey      = 'spotify_auth_state';
var scope         = 'user-read-private user-read-email playlist-read-private';


app.use( express.static( __dirname + '/public' )).use( cookieParser());


/**
 * Called when "login" Spotify logo is clicked.
 * Makes a call to Spotify "authorize" API.
 */
app.get( '/login', function( req, res ) {

  var state = u.randomString( 64 );
  res.cookie( stateKey, state );

  u.redirect( res, 'https://accounts.spotify.com/authorize?', {
    response_type: 'code',
    client_id:     client_id,
    scope:         scope,
    redirect_uri:  redirect_uri,
    state:         state
  });
});


/**
 * Called by Spotify "authorize" callback.
 * Redirects to the application's page.
 */
app.get( '/callback', function( req, res ) {

  var code        = req.query.code  || null;
  var state       = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (( state === null ) || ( state !== storedState )) {
    u.redirect( res, '/#', { error: 'state_mismatch' });
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

        var access_token  = body.access_token;
        var refresh_token = body.refresh_token;

        u.redirect( res, '/#', { access_token: access_token, refresh_token: refresh_token });
      } else {
        u.redirect( res, '/#', { error: 'invalid_token' });
      }
    });
  }
});


/**
 * Called when user clicks "export" link.
 * Sends back a ZIP file with playlist or playlists selected.
 */
app.get( '/export', function( req, res ) {

  var token       = u.param( req, 't' );
  var user_id     = u.param( req, 'u' );
  var playlist_id = u.param( req, 'p' );

  if (( token === null ) || ( user_id === null ) || ( playlist_id === null )) {
    console.log( util.format( "Missing parameters in 'export' request: token = [%s], user ID = [%s], playlist ID = [%s]",
                              token, user_id, playlist_id ));
    res.send( 'Error' );
  } else {
    u.export_playlist( res, token, user_id, playlist_id )
  }
});


console.log( 'http://127.0.0.1:8080 is waiting for you!' );
app.listen( 8080 );
