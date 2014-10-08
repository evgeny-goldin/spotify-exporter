"use strict";

var _    = require( 'underscore' );
var util = require( 'util' );
var hu   = require( './http-utils' );


/**
 * Exports a playlist specified by sending it in a ZIP response.
 * @param {res}          response to send ZIP to
 * @param {token}        access token
 * @param {user_id}      user ID of playlist owner
 * @param {playlist_id}  playlist ID
 */
exports.export_playlist = function( res, token, user_id, playlist_id, callback ) {

  var date       = new Date();
  var start_time = date.getTime();

  if ( playlist_id == null ) {
    // Export all user's playlists
    // https://developer.spotify.com/web-api/get-list-users-playlists/

    hu.get( token, hu.user_playlists_url( user_id ), function( response ){
      var playlists          = response.items;
      var playlists_reported = {};
      _.each( playlists, function( playlist ){
        exports.export_playlist( res, token, playlist.owner.id, playlist.id, function( playlists_json ){
          playlists_reported[ playlists_json.uri ] = playlists_json
          var reported                             = Object.keys( playlists_reported ).length
          console.log( util.format( "%s playlists out of %s reported", reported, playlists.length ));

          if ( reported == playlists.length ) {

            // Calculating array of playlists lengths (each element is some playlist's length) and summing it up
            var playlist_lengths = _.map( playlists_reported,  function( playlists_json ){ return playlists_json.tracks.length });
            var tracks           = _.reduce( playlist_lengths, function( sum, size ){ return sum + size });

            console.log( util.format( "%s tracks of %s playlists fetched in %s ms",
                                      tracks, playlists.length, elapsed_time( start_time )));
          }
        });
      });
    });
  } else {
    // Export a playlist specified
    // https://developer.spotify.com/web-api/get-playlist/

    console.log( util.format( "Reading playlist '%s' of '%s'", playlist_id, user_id ));

    hu.get( token, hu.playlist_url( user_id, playlist_id ), function( response ){

      var playlist = {
        'start_time'  : start_time,
        'exported on' : date.toString(),
        'name'        : response.name,
        'url'         : response.external_urls.spotify,
        'uri'         : response.uri,
        'owner'       : response.owner.id,
        'tracks'      : read_tracks( response.tracks.items )
      }

      export_playlist_paginate( res, token, playlist, response.tracks.next, callback );
    });
  }
}


/**
 * Exports a playlist specified by sending it in a ZIP response, paginating over all tracks.
 * @param {res}        response to send ZIP to
 * @param {token}      access token
 * @param {playlist}   playlist JSON
 * @param {tracks_url} URL to read playlist tracks from, null when pagination is over
 */
var export_playlist_paginate = function( res, token, playlist, tracks_url, callback ) {

  if ( tracks_url === null ) {
    // Pagination is over, no more tracks to fetch

    console.log( util.format( "%s tracks of playlist '%s' fetched in %s ms",
                              playlist.tracks.length, playlist.name, elapsed_time( playlist.start_time )))
    playlist.start_time = undefined;

    if ( typeof callback == 'undefined' ){
      hu.send_zip_response( res, playlist.name, JSON.stringify( playlist, null, '  ' ));
    } else {
      callback( playlist )
    }
  } else {
    // Pagination continues, there are more tracks to fetch
    hu.get( token, tracks_url, function( response ){
      playlist.tracks = playlist.tracks.concat( read_tracks( response.items ))
      export_playlist_paginate( res, token, playlist, response.next, callback )
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
      'name'    : track.name,
      'album'   : track.album.name,
      'artists' : _.map( track.artists, function( artist ){ return artist.name }).join( ', ' ),
      'duration': duration( track.duration_ms ),
      'uri'     : track.uri,
      'preview' : track.preview_url
    }
  })
}


/**
 * Retrieves amount of milliseconds elapsed since the start time specified.
 * @param  {start_time} start time
 * @return {number}     amount of milliseconds elapsed since the start time
 */
var elapsed_time = function( start_time ) {
  return ( new Date().getTime() - start_time );
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
