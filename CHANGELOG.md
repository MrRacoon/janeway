## 0.2.2 (WIP)

## 0.2.1 (2016-10-18)

* Added spinners, which can be rendered in the statusbar
* Added `Janeway#redraw`, which forces a re-render
* Added indicators

## 0.2.0 (2016-10-14)

* Added menu bar
* Added 'Copy' button to copy current selection to the clipboard
* The currently selected object/string will be stored under the $0 global
* `Janeway#setTitle(str)` will now set the title of the terminal tab
* Remove 'Line 0' when Janeway starts
* If a new line contains the same data as the previous one, it is not
  printed to screen, but a counter is added to that previous line.
* The CLI now uses a modified Textarea widget: arrow keys, delete, home, end now all work as they should
* Added a statusbar under the CLI, which can be set using `Janeway#setStatus`, it should only be given regular text, though it does support blessed tags.
* Move classes to the Develry.Janeway namespace
* The Janeway instance can now be accessed at the `__Janeway` global
* Only +/- 1000 lines will be stored, when going over that the top lines will be removed
* `eval` is no longer used to evaluate CLI code, now `vm#runInNewContext` is used
* The new CLI evaluation now has access to `require`
* Because of ditching `eval`, declaring variables (or asigning without `var`) will no longer create a global. In order to create on, you'll have to do something like `global.myglobal = 'globalvalue'`
* Added `getPropertyNames` to recursively look through an object's prototype chain to fill the autocomplete popup
* Command evaluation will first wrap the command in parentheses, if it fails it tries it without them.
* The `janeway` command will set the title on boot
* Autocomplete will now also select current item when typing '(', it already does this for '.', a tab and an enter

## 0.1.6 (2016-06-02)

* Add brackets when opening objects
* Also split strings on \r\n or \r newlines
* Show `__proto__` property when inspecting objects
* Add timestamp to loglines
* Remove '.js' from filenames
* Added `uncaughtException` listener to print errors before crashing
* Changed scrolledManually and scrollDown property to underscored name
* Let Janeway handle application crashes better

## 0.1.5 (2016-01-24)

* Add autocomplete (basic for now)
* Add CLI history
* Allow Janeway to be run globally
* Add date object to line info

## 0.1.4 (2016-01-20)

* Improve multiline string support
* Upgrade `blessed` dependency to 0.1.81
* Throttle the `render` method to not overload the process
* Automatically scroll down when new line is added
* Clicking on functions will now read out properties
* Pressing pageup/pagedown will scroll up or down
* Fix click/scroll index issues

## 0.1.3 (2015-03-07)

* Stringify Objects using util.inspect, to prevent toJSON interference
* Caller info is added (where the output came from in the script)
* Strings with newlines will be printed out along multiple lines when selected
* Updated blessed dependency

## 0.1.2 (2015-01-26)

* Fixed bug where lines were kept in memory and causes screen glitches
* Fixed global scope command problem (removed vm in favour of regular eval)
* Added Janeway.debug method, which outputs to a logfile
* Upgraded "blessed" dependency to 0.0.38
* More minor bugfixes

## 0.1.1 (2014-09-15)

* require('janeway') will now return an instance of the Janeway class
* Janeway now takes command of `stdout`, `stderr` and all the `console` methods
* Janeway is now also an event emitter (Using Protoblast's Informer class)
* Newlines are now replaced with a Unicode return symbol
* Added new commands to the CLI:
  - 'exit' will exit Janeway and the running app (as will Escape or Control+C)
  - 'cls' will clear the screen

## 0.1.0 (2014-09-14)

* Initial Github commit and npm release!
