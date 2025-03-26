## v2.0.0

* Stop the extension startup from stealing application focus.
* All extension settings names are changed; you will need to manually copy the new ones across. 
* Apama 10.15.6.0 is the minimum version required for Language Server support.
* Fixed automatic Language Server start up - if Apama is installed in a default location, or the `apamaHome` preference set to a valid location, the Language Server will automatically start up.
* The "Create Project" command requires a minimum of 10.15.6.2.
* A single workspace folder is now considered to hold just one project, at the top level.

# Old versions

## v1.2.1

* First release under ApamaCommunity.

## v1.0.1 (June 2020)

* Finished syntax highlighting.
* Documentation.
* Apama EPL diagnostics (via LSP support in eplbuddy tool).
* Integration with apama_project tool.
* Fixed small bug when starting the Language Server.

## v0.2.0 to v0.9.0 (February 2020)

* Better syntax highlighting, Snippets, Apama EPL debugging
* Snippets support and further syntax highlighting added
* Cleanup of code and rewrite of the tmLanguage file
* Small readme change and addition of image dir.

## v0.1.0 (February 2020)

* Initial release (started June 2018)
* Basic highlighting with some support for more complex code structures.
* Placeholder for command functionality
