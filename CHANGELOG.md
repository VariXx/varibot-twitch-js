# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
<!-- _No unreleased changes_ -->
## [1.3.0] - 
### Added 
- Added Philips HUE support
- Added HUE settings page

### Changed
- Pubsub nonce randomly generated on connect

## [1.2.0] - 2020-09-03
### Added 
- Added run 90 second ad button
- Added create stream marker button
- Added BRB quick action that creates a stream marker and runs a 90 second ad 
- Added button to upload Google creds file for Google Spreadsheets 

### Changed
- Changed how .mp3 is removed from button label
- Changed Google Spreadsheets settings to read from URL 
- Google creds now load before running Google related commands. Bot does not need to be restarted after updating Google creds file. 

### Fixed
- Fixed stream marker command 
- Bot will give an error message when connecting if token is invalid

### Removed
- Removed reloading sounds when switching to dashboard

## [1.1.1] - 2020-08-28
### Changed
- Sounds reload when switching to home page
- Settings page loads content like other pages 

### Fixed
- Fixed buttons in settings page incorrectly returning to home page 

## [1.1.0] - 2020-08-28
### Added
- Added cards for general and google spreadsheets settings in Settings page
- Added [Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/) license info
- Added auto update notification messages
- Added play button to sounds in sounds settings page
- Added quick actions and recent cards
- Added play random sound button to quick actions
- Added about page

### Changed
- Changed Google Spreasheets to load creds from file
- Changed functions to load from individual files in utils directory
- Changed changelog to correct formatting for change types 
- Changed window title and electron builder product name
- Changed installer to use electron builder default settings
- Changed Bootstrap theme to [Darkly](https://bootswatch.com/darkly/) 
- Changed button class for hover effect
- Removed .mp3 from sound labels in home
- Changed settings cards titles to headers
- Changed card layouts on home page
- Changed how settings are read and saved on commands settings page

### Fixed
- Fixed clientid not populating if null

### Security
- Updated lodash for CVE-2020-8203

## [1.0.3] - 2020-08-23
- Updated lodash for vulnerabilities

## [1.0.1] - 2020-06-30
### Added
- Added Changelog
- Added setup steps to readme
- Added colors to status messages

### Changed
- Changed status box to card 

## [1.0.0] - 2020-06-25
### Initial Release

[1.2.0]: https://github.com/VariXx/varibot-twitch-js/tree/v1.3.0
[1.2.0]: https://github.com/VariXx/varibot-twitch-js/tree/v1.2.0
[1.1.1]: https://github.com/VariXx/varibot-twitch-js/tree/v1.1.1
[1.1.0]: https://github.com/VariXx/varibot-twitch-js/tree/v1.1.0
[1.0.3]: https://github.com/VariXx/varibot-twitch-js/tree/v1.0.3
[1.0.1]: https://github.com/VariXx/varibot-twitch-js/tree/v1.0.1
[1.0.0]: https://github.com/VariXx/varibot-twitch-js/tree/v1.0.0
[Unreleased]: https://github.com/VariXx/varibot-twitch-js/compare/master...develop
