
#### Spotify Exporter

Exports your Spotify playlists! *(not that you have to, they __do__ backups)*

* [Create](https://developer.spotify.com/my-applications/#!/applications/create) a new Spotify application
* Create `"app.json"`, similar to `"app-example.json"`, filling in application's `"id"` and `"secret"`
* `npm install`
* `node app.js`
* `open http://127.0.0.1:8080`
* Click Spotify logo to login
* In a list of playlists click specific playlist to download its archive or **Playlists** to download an archive of all playlists
* It may take a while to read all tracks. Watch the application's console for a progress
