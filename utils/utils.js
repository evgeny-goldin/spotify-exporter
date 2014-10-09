"use strict";

var _  = require( 'underscore' );
var hu = require( './http-utils' );


/**
 * Exports a playlist specified by sending it in a ZIP response.
 * @param {res}          response to send ZIP to
 * @param {token}        access token
 * @param {user_id}      user ID of playlist owner
 * @param {playlist_id}  playlist ID, null if all playlists need to be exported
 */
exports.export = function( res, token, user_id, playlist_id ) {

  if ( playlist_id === null ){
    // Reading all user's playlists
    // https://developer.spotify.com/web-api/get-list-users-playlists/
    hu.get( token, hu.user_playlists_url( user_id ), function( response ){
      // Array of { user_id: playlist_id } mappings
      var playlists = _.map( response.items, function( spotify_playlist ){
        var user_id     = spotify_playlist.owner.id
        var playlist_id = spotify_playlist.id
        return hash( user_id, playlist_id );
      });
      export_playlists( res, token, playlists );
    });
  } else {
    export_playlists( res, token, [ hash( user_id, playlist_id ) ] );
  }
}


/**
 * Exports playlists specified by sending it in a ZIP response.
 * @param {res}       response to send ZIP to
 * @param {token}     access token
 * @param {playlists} Array of { user_id: playlist_id } mappings
 */
var export_playlists = function( res, token, playlists ) {

  var start_time          = now();
  var number_of_playlists = Object.keys( playlists ).length;
  var export_playlists    = [];

  _.each( playlists, function( playlist ){
    _.each( playlist, function( playlist_id, user_id ){

      read_playlist( res, token, user_id, playlist_id, function( export_playlist ){
        export_playlists.push( export_playlist );

        if ( export_playlists.length == number_of_playlists ) {
          // All user's playlists have been reported
          console.log( "%s playlist%s read in %s ms",
                       number_of_playlists, s( number_of_playlists ),
                       elapsed_time( start_time ));
          hu.send_zip_response( res, export_playlists );
        }
      });
    });
  });
}


/**
 * Reads all tracks of the playlist specified.
 * @param {res}         response to send ZIP to
 * @param {token}       access token
 * @param {user_id}     user ID of playlist owner
 * @param {playlist_id} playlist ID
 * @param {callback}    callback to invoke with constructed playlist to export
 */
var read_playlist = function( res, token, user_id, playlist_id, callback ) {

  var start_time = now();
  console.log( "Reading playlist '%s' of '%s'", playlist_id, user_id );

  // Reading playlist data (name, uri, owner, tracks)
  // https://developer.spotify.com/web-api/get-playlist/
  hu.get( token, hu.playlist_url( user_id, playlist_id ), function( spotify_playlist ){

    var export_playlist = {
      'start_time'  : start_time,
      'name'        : spotify_playlist.name,
      'id'          : spotify_playlist.id,
      'url'         : spotify_playlist.external_urls.spotify,
      'uri'         : spotify_playlist.uri,
      'owner'       : 'spotify:user:' + spotify_playlist.owner.id,
      'exported_on' : new Date().toUTCString(),
      'tracks_total': spotify_playlist.tracks.total,
      'tracks'      : read_tracks( spotify_playlist.tracks.items )
    }

    read_playlist_paginate( res, token, export_playlist, spotify_playlist.tracks.next, callback );
  });
}


/**
 * Exports a playlist specified by sending it in a ZIP response, paginating over all tracks.
 * @param {res}             response to send ZIP to
 * @param {token}           access token
 * @param {export_playlist} JSON of a playlist, export format
 * @param {tracks_url}      URL to read playlist tracks from, null when pagination is over
 * @param {callback}        callback to invoke with constructed playlist to export
 */
var read_playlist_paginate = function( res, token, export_playlist, tracks_url, callback ) {

  if ( tracks_url === null ) {
    // Pagination is over, no more tracks left to read

    console.log( "%s tracks of playlist '%s' (%s) read in %s ms",
                 export_playlist.tracks_total, export_playlist.name, export_playlist.id,
                 elapsed_time( export_playlist.start_time ))

    export_playlist.start_time = undefined;
    callback( export_playlist );
  } else {
    // Pagination continues, there are more tracks to read
    // Reading playlists's tracks
    // https://developer.spotify.com/web-api/get-playlists-tracks/
    hu.get( token, tracks_url, function( response ){
      export_playlist.tracks = export_playlist.tracks.concat( read_tracks( response.items ))
      read_playlist_paginate( res, token, export_playlist, response.next, callback )
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
  return _.map( track_items, function( track_item ){
    var track = track_item.track;
    return {
      'name'    : track.name,
      'album'   : track.album.name,
      'artists' : _.map( track.artists, function( artist ){ return artist.name }).join( ', ' ),
      'duration': duration( track.duration_ms ),
      'uri'     : track.uri,
      'preview' : track.preview_url
    }
  })
}


var now          = function(){ return Date.now() }
var s            = function( j          ) { return ( j == 1 ? '' : 's' )}
var elapsed_time = function( start_time ) { return ( now() - start_time ) }
var sum          = function( array      ) { return _.reduce( array, function( sum, j ){ return sum + j })}
var hash         = function( key, value ) { var hash = {}; hash[ key ] = value; return hash }


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

  return pad( minutes ) + ':' + pad( seconds );
}
