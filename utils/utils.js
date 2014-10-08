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
exports.export = function( res, token, user_id, playlist_id, callback ) {
  ( playlist_id == null ) ? export_all_playlists( res, token, user_id ) :
                            export_playlist( res, token, user_id, playlist_id );
}


var export_all_playlists = function( res, token, user_id ) {

  // Reading all user's playlists
  // https://developer.spotify.com/web-api/get-list-users-playlists/
  hu.get( token, hu.user_playlists_url( user_id ), function( response ){

  /**
   * Iterating over all user's playlists and exporting them one-by-one.
   *
   * 'spotify_playlist' - JSON of a playlist, full Spotify format
   * 'export_playlist'  - JSON of a playlist, short export format
   * 'export_playlists' - array of export_playlists
   */

    var start_time          = now()
    var number_of_playlists = response.items.length;
    var export_playlists    = [];

    _.each( response.items, function( spotify_playlist ){

      var user_id     = spotify_playlist.owner.id;
      var playlist_id = spotify_playlist.id;

      export_playlist( res, token, user_id, playlist_id, function( export_playlist ){
        export_playlists.push( export_playlist );

        console.log( "%s playlists out of %s are reported", export_playlists.length, number_of_playlists );

        if ( export_playlists.length == number_of_playlists ) {
          // All user's playlists have been reported
          var total_tracks = sum( _.map( export_playlists, function( export_playlist ) {
            return export_playlist.total_tracks
          }));

          console.log( "%s tracks of %s playlists fetched in %s ms",
                       total_tracks, number_of_playlists, elapsed_time( start_time ));

          hu.send_zip_response( res, export_playlists );
        }
      });
    });
  });
}


var export_playlist = function( res, token, user_id, playlist_id, callback ) {

  console.log( "Reading playlist '%s' of '%s'", playlist_id, user_id );

  // Reading playlist data (name, uri, owner, tracks)
  // https://developer.spotify.com/web-api/get-playlist/
  hu.get( token, hu.playlist_url( user_id, playlist_id ), function( response ){

    var export_playlist = {
      'start_time'  : now(),
      'name'        : response.name,
      'id'          : response.id,
      'url'         : response.external_urls.spotify,
      'uri'         : response.uri,
      'owner'       : 'spotify:user:' + response.owner.id,
      'exported_on' : new Date().toUTCString(),
      'total_tracks': response.tracks.items.length,
      'tracks'      : read_tracks( response.tracks.items )
    }

    export_playlist_paginate( res, token, export_playlist, response.tracks.next, callback );
  });
}


/**
 * Exports a playlist specified by sending it in a ZIP response, paginating over all tracks.
 * @param {res}             response to send ZIP to
 * @param {token}           access token
 * @param {export_playlist} JSON of a playlist, export format
 * @param {tracks_url} URL to read playlist tracks from, null when pagination is over
 */
var export_playlist_paginate = function( res, token, export_playlist, tracks_url, callback ) {

  if ( tracks_url === null ) {
    // Pagination is over, no more tracks left to fetch

    console.log( "%s tracks of playlist '%s' (%s) fetched in %s ms",
                 export_playlist.total_tracks, export_playlist.name, export_playlist.id,
                 elapsed_time( export_playlist.start_time ))

    export_playlist.start_time = undefined;

    // When pagination is over and no callback is provided (user requested export of a single playlist) -
    // export_playlist is sent as Zip, othwerwise callback is invoked (it'll eventually send all playlists as a Zip)
    if ( typeof callback == 'undefined' ){
      hu.send_zip_response( res, [ export_playlist ] );
    } else {
      callback( export_playlist )
    }
  } else {
    // Pagination continues, there are more tracks to fetch
    // Reading playlists's tracks
    // https://developer.spotify.com/web-api/get-playlists-tracks/
    hu.get( token, tracks_url, function( response ){
      export_playlist.tracks       = export_playlist.tracks.concat( read_tracks( response.items ))
      export_playlist.total_tracks = export_playlist.tracks.length
      export_playlist_paginate( res, token, export_playlist, response.next, callback )
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
var elapsed_time = function( start_time ) { return ( now() - start_time ) }
var sum          = function( array      ) { return _.reduce( array, function( sum, j ){ return sum + j })}


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
