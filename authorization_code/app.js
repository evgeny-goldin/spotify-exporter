/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express       = require( 'express'); // Express web server framework
var request       = require( 'request'); // "Request" library
var querystring   = require( 'querystring');
var cookieParser  = require( 'cookie-parser');
var fs            = require( 'fs');
var app           = JSON.parse( fs.readFileSync( '../app.json', { "encoding":"UTF-8" }));
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
var generateRandomString = function(length) {
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


app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get( '/export', function( req, res ) {
  res.writeHead( 200, { 'Content-Type':        'application/zip',
                        'Content-disposition': 'attachment; filename=export.zip' });

  var archiver = require( 'archiver' );
  var zip      = archiver( 'zip' );
  zip.pipe( res );
  zip.append( 'Some text to go in file 1.', { name: '1.txt' }).
      finalize();
});


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

  if (state === null || state !== storedState) {
    redirect( res, '/#', { error: 'state_mismatch' });
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
        client_id: client_id,
        client_secret: client_secret
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

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

app.get( '/refresh_token', function( req, res ) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString( 'base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log( 'http://127.0.0.1:8080' );
app.listen( 8080 );
