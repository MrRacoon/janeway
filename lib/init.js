// If Janeway has already been loaded, return that
if (typeof __Janeway !== 'undefined') {
	module.exports = __Janeway;
	return;
}

var Blast = require('protoblast')(false), // Protoblast without native mods
    util  = require('util'),
    ncp   = require('copy-paste'),
    vm    = require('vm'),
    fs    = require('fs'),
    JanewayClass,
    vm_context,
    Janeway,
    starting = false,
    started = false,
    libpath = require('path'),
    consoleWidth  = process.stdout.columns,
    consoleHeight = process.stdout.rows,
    multiply = Blast.Bound.String.multiply,
    configs,
    Editarea,
    stripEsc,
    outputs,
    Status,
    esc;


// Attempt to load user-defined configs
try {
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
    configs = JSON.parse(fs.readFileSync(home + '/.janeway.json'));
} catch (e) {
    console.log(e);
    configs = {}
}

console.log(configs);

/**
 * The Janeway class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 */
JanewayClass = Blast.Collection.Function.inherits('Informer', 'Develry.Janeway', function Janeway() {

	// Open popup boxes
	this.open_popups = {};

	// CLI history
	this.cli_history = [];

	// Current cli history index
	this.cli_history_index = -1;

	// The stashed cli input
	this.cli_stash = '';

	// Status lines
	this.status_lines = [];

	// Create the context which will be used for evaluating code
	vm_context = Object.create(global);
	vm_context.module = module;
	vm_context.janeway = this;
	vm_context.cls = null;

	/**
	 * Set current working directory first
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.2.0
	 * @version  0.2.0
	 */
	vm_context.require = function _require(path) {

		try {
			// Try regular require first, in case of requiring built-in modules
			return require(path);
		} catch (err) {
			path = libpath.resolve(process.cwd(), 'node_modules', path);
			return require(path);
		}
	};
});

/**
 * Expose Protoblast
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
JanewayClass.setProperty('Blast', Blast);

/**
 * Spinners object
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
JanewayClass.setProperty('spinners', {});

/**
 * Scrolldown on new data (true by default)
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.4
 * @version  0.1.4
 */
JanewayClass.setProperty('scroll_down', true);

/**
 * Has the user scrolled manually?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.4
 * @version  0.1.4
 */
JanewayClass.setProperty('scrolled_manually', false);

/**
 * Add an uncaughtException handler?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.6
 * @version  0.1.6
 */
JanewayClass.setProperty('catch_exceptions', true);

/**
 * Shutdown on caught exceptions?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.6
 * @version  0.1.6
 */
JanewayClass.setProperty('shutdown_on_exception', true);

/**
 * Re-emit caught uncaughtExceptions on Janeway?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.6
 * @version  0.1.6
 */
JanewayClass.setProperty('re_emit_exceptions', false);

/**
 * Verbosity levels
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.4
 * @version  0.1.4
 */
JanewayClass.setProperty('LEVELS', {
	'FATAL':     0,
	'SEVERE':    1,
	'ERROR':     2,
	'WARNING':   3,
	'TODO':      4,
	'INFO':      5,
	'DEBUG':     6,
	'HIDEBUG':   7
});

/**
 * Default indicator options
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.1
 * @version  0.2.1
 */
JanewayClass.setProperty('default_indicator_options', {

	// Default content icon
	icon         : '◆',

	// Indicator class name
	type         : '',

	// Weight of the indicator (for position)
	weight       : 10
});

/**
 * Simple function to enter terminal colour codes
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Number|String}  code  The code(s) to escape
 * @param    {String}         str   If given: Add string and reset code
 *
 * @return   {String}
 */
JanewayClass.setMethod(function esc(code, str, endcode) {

	var result = '\u001b[' + code + 'm';

	if (typeof str !== 'undefined') {

		if (typeof endcode === 'undefined') {
			endcode = 0;
		}

		result += str + esc(endcode);
	}

	return result;
});

esc = JanewayClass.prototype.esc;

/**
 * Strip terminal colour escape sequences from a string
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.1
 *
 * @param    {String}  str       The string containing escape sequences
 * @param    {Boolean} literal   Remove literal representations in strings
 *
 * @return   {String}
 */
JanewayClass.setMethod(function stripEsc(str, literal) {
	var result = str.replace(/\u001b\[(\d\;?)+m/g, '');

	if (literal) {
		result = result.replace(/\\u001(?:b|B)\[(\d\;?)+m/, '');
	}

	return result;
});

stripEsc = JanewayClass.prototype.stripEsc;

/**
 * Create augmented versions of the `stdout` and `stderr` objects.
 * After that, we set the `write` functions on those augmented objects.
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.1
 * @version  0.1.1
 */
outputs = {};

// Try getting the standard inputs/outputs
try {
	outputs.stdin = process.stdin;
	outputs.stdout = Object.create(process.stdout);
	outputs.stderr = Object.create(process.stderr);

	outputs.stdout.write = process.stdout.write;
	outputs.stderr.write = process.stderr.write;
} catch (err) {
	// This will fail on nw.js in windows
}

/**
 * Set the terminal tab title
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {String}  title
 */
JanewayClass.setMethod(function setTitle(title) {

	var cmd;

	// Create the command string if a title is given
	if (typeof title == 'string') {
		cmd = String.fromCharCode(27) + ']0;' + title + String.fromCharCode(7);
		this._title_has_been_set = true;
	} else {
		// Revert the title
		cmd = String.fromCharCode(27) + ']2;' + String.fromCharCode(7);
		this._title_has_been_set = false;
	}

	// Output to the actual stdout
	outputs.stdout.write(cmd);
});

/**
 * Set the bottom status bar
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.1
 *
 * @param    {String}          text
 * @param    {Boolean|String}  spinner
 *
 * @return   {Janeway.Status}
 */
JanewayClass.setMethod(function setStatus(text, spinner) {

	if (this.current_status) {
		this.current_status.stop();
	}

	this.current_status = new Janeway.Status(this, text, spinner);

	return this.current_status;
});

/**
 * Add indicator
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.1
 * @version  0.2.1
 *
 * @param    {Object} options
 *
 * @return   {Janeway.Indicator}
 */
JanewayClass.setMethod(function addIndicator(options) {

	var constructor,
	    indicator,
	    children,
	    name,
	    temp,
	    i;

	options = Blast.Bound.Object.assign({}, this.default_indicator_options, options);

	if (options.type) {
		children = Janeway.Indicator.getChildren();
		name = Blast.Bound.String.classify(options.type) + 'Indicator';

		for (i = 0; i < children.length; i++) {
			temp = children[i];

			if (temp.name == name) {
				constructor = temp;
				break;
			}
		}
	}

	if (!constructor) {
		constructor = Janeway.Indicator;
	}

	indicator = new constructor(this, options);

	return indicator;
});

/**
 * Output debug messages to an external file
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.2
 * @version  0.1.2
 *
 * @param    {Mixed}  message
 */
JanewayClass.setMethod(function debug(message) {

	var str;

	if (message instanceof Error) {
		str = message.message + '\n' + message.stack;
	} else {
		str = require('util').inspect(message, {colors: true});
	}

	require('fs').appendFileSync('/tmp/janewaydebug.log', str + '\n');
});

/**
 * Redraw the screen
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.1
 * @version  0.2.1
 */
JanewayClass.setMethod(function redraw() {
	this.screen.alloc();
});

/**
 * Extract info from a single stack line
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.1.3
 * @version  0.1.3
 *
 * @param   {String}   caller_line   The string
 *
 * @return  {Object}   An object containing the info
 */
JanewayClass.setMethod(function extractLineInfo(caller_line) {

	var result,
	    index,
	    clean,
	    temp;

	// Get the index
	index = caller_line.indexOf('at ');

	// Get the error line, without the '  at ' part
	clean = caller_line.slice(index+2, caller_line.length);

	result = /^ (.*?) \((.*?):(\d*):(\d*)\)/.exec(clean);

	// If nothing was found, it's probably an anonymous function
	if (!result) {
		temp = /(.*?):(\d*):(\d*)/.exec(clean);

		if (!temp) {
			temp = ['unknown', 'unknown', 'unknown', 'unknown'];
		}

		result = ['', 'anonymous', temp[1], temp[2], temp[3]];
	}

	return {
		name: result[1],
		path: result[2],
		file: result[2].split('/').pop(),
		line: result[3],
		char: result[4]
	};
});

/**
 * Get info on the caller: what line this function was called from
 * This is done by creating an error object, which in its turn creates
 * a stack trace string we can manipulate
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.3
 * @version  0.1.3
 *
 * @param   {Integer}   level   Skip x many callers
 *
 * @return  {Object}    An object contain caller info
 */
JanewayClass.setMethod(function getCallerInfo(level, err) {

	var caller_line,
	    stack,
	    copy,
	    key,
	    msg,
	    obj,
	    def,
	    ar,
	    i;

	if (err && err.type === 'callerInfo') {

		// Shallow clone the object
		err = Blast.Bound.Object.assign({}, err);

		if (typeof err.level !== 'undefined') {
			for (key in err.stack[err.level]) {
				err[key] = err.stack[err.level][key];
			}
		}

		return err;
	}

	if (typeof level === 'undefined') level = 0;

	level += 3;

	if (typeof err == 'string') {
		msg = err;
		err = undefined;
	}

	if (!err) {

		def = Error.stackTraceLimit;

		// Set the stacktracelimit, we don't need anything above the wanted level
		Error.stackTraceLimit = 1 + level;

		err = new Error(msg);

		// Now reset the stacktracelimit to its default
		Error.stackTraceLimit = def;
	}

	// Some errors don't have a stack
	stack = err.stack || '';

	// Turn the stack string into an array
	ar = stack.split('\n');

	// Get the caller line
	caller_line = ar[level];

	if (!caller_line) {
		caller_line = ar[ar.length-1];
	}

	obj = this.extractLineInfo(caller_line);
	obj.text = stack;

	obj.stack = [];

	copy = ar.splice(0);

	// Remove the first entry in the array
	copy.shift();

	for (i = 0; i < copy.length; i++) {
		obj.stack.push(this.extractLineInfo(copy[i]));
	}

	obj.err = err;
	obj.message = err.message;
	obj.name = err.name;
	obj.type = 'callerInfo';
	obj.seen = 1;

	return obj;
});

/**
 * Indent text
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.3
 * @version  0.1.3
 *
 * @return  {String}
 */
JanewayClass.setMethod(function indent(text, skipText, skipFirstLine) {

	var lines        = text.split('\n'),
	    visibleCount = stripEsc(skipText).length,
	    hiddenCount  = skipText.length,
	    difference   = hiddenCount - visibleCount,
	    maxWidth,
	    uselength,
	    lineNr,
	    line,
	    length,
	    hiddenLength,
	    visibleLength,
	    result;

	if (typeof skipFirstLine === 'undefined') skipFirstLine = true;
	if (skipFirstLine) {
		skipFirstLine = 1;
	} else {
		skipFirstLine = 0;
	}

	for (i = 0; i < lines.length; i++) {

		if (i == 0 && skipFirstLine){
			maxWidth = consoleWidth + difference;
		} else {
			lines[i] = multiply(' ', visibleCount) + lines[i];
			maxWidth = consoleWidth;
		}

		line = lines[i];

		hiddenLength = line.length;
		visibleLength = stripEsc(line).length;

		if (visibleLength > consoleWidth) {
			lines[i] = line.substring(0, maxWidth) + '\n' + multiply(' ', visibleCount) + line.substring(maxWidth);
		}
	}

	return lines.join('\n');
});

/**
 * Output messages
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.3
 * @version  0.1.5
 *
 * @param    {String}  type
 * @param    {Array}   args
 * @param    {Object}  options
 */
JanewayClass.setMethod(function print(type, args, options) {

	var i,
	    info,
	    level,
	    trace,
	    output;

	if (!options) {
		options = {};
	}

	if (typeof options.verbosity == 'undefined') {
		options.verbosity = this.LEVELS.INFO;
	}

	level = options.level || 0;

	if (options.err) {
		level -= 3;
	}

	info = this.getCallerInfo(options.level, options.err);
	options.info = info;
	info.time = new Date();

	if (this.logList) {
		this.logList.consoleLog(args, type, options);
	} else {
		trace = esc(90, '[') + type + esc(90, '] ') + esc(90, '[') + esc(1, info.file + ':' + info.line) + esc(90, '] ');
		output = trace;

		for (i = 0; i < args.length; i++) {

			if (args[i] && typeof args[i] != 'string') {
				args[i] = util.inspect(args[i], {colors: true});
			}

			if (typeof args[i] != 'string') {
				output += util.inspect(args[i], {colors: true});
			} else {
				output += args[i];
			}
		}

		// Remove colours when terminal doesn't support them
		if (!process.env.COLORTERM) {
			output = stripEsc(output);
		}

		try {
			output = this.indent(output, trace);
		} catch (err) {
			console.log(err);
		}

		console.log(output);
	}
});

/**
 * Scroll the main window
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.4
 * @version  0.2.0
 *
 * @param    {Number}  direction
 * @param    {Boolean} force_render   Set to true to render immediately
 */
JanewayClass.setMethod(function scroll(direction, force_render) {

	var before,
	    after;

	if (direction == null) {
		direction = 1;
	}

	before = this.logList.box.getScrollPerc();
	this.logList.box.scroll(direction);
	after = this.logList.box.getScrollPerc();

	// Undo scroll if nothing changed
	if (before == 0 && after == 0) {
		this.logList.box.scroll(0 - direction);
	}

	if (force_render) {
		this.logList.render();
	}
});

/**
 * Keep the newest line in screen, unless the user has scrolled away
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.4
 * @version  0.1.4
 *
 * @param    {Boolean}   or_render   If scroll_down is false, render the box at least (true)
 */
JanewayClass.setMethod(function scrollAlong(or_render) {
	if (this.scroll_down) {

		if (!this.scrolled_manually) {
			this.scroll(1);
		}

		this.logList.render();
	} else if (or_render !== false) {
		this.logList.render();
	}
});

/**
 * Show a popup
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.5
 * @version  0.1.5
 *
 * @param    {String}   id       The unique id (only 1 can be open at a time)
 * @param    {Object}   options
 *
 * @return   {ListBox}
 */
JanewayClass.setMethod(function popup(id, options) {

	var list;

	if (!options) {
		if (this.open_popups[id]) {
			this.open_popups[id].destroy();
		}

		return;
	}

	if (!options.position) {
		options.position = {};
	}

	if (options.position.bottom == null) {
		options.position.bottom = 3;
	}

	if (options.position.height == null) {
		options.position.height = 6;
	}

	if (this.open_popups[id]) {
		this.open_popups[id].destroy();
	}

	// Create a new list
	list = this.blessed.list({
		//bottom: 2,
		position: options.position,
		width: '100%',
		items: options.items,
		mouse: true, // Allow selecting items with the mouse
		scrollbar: {
			bg: 'green'
		},
		border: {
			type: 'line'
		},
		shadow: true,
		style: {
			bg: 'blue',
			fg: 'white'
		}
	});

	// Store the popup under its unique id
	this.open_popups[id] = list;

	// Add it to the screen
	this.screen.append(list);

	// Make sure it's in the front
	list.setFront();

	// Render the screen
	this.screen.render();

	return list;
});

/**
 * Get the property names of the given object,
 * follow the prototype chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Object}    target
 *
 * @return   {Array}
 */
JanewayClass.setMethod(function getPropertyNames(target) {

	var proto,
	    result;

	// Get the descriptor
	result = Object.getOwnPropertyNames(target);

	// Config wasn't found, look up the prototype chain
	if (typeof target == 'function') {
		proto = target.prototype;
	} else {
		proto = Object.getPrototypeOf(target);
	}

	if (proto) {
		return result.concat(getPropertyNames(proto));
	}

	return result;
});

/**
 * Show the autocomplete
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.5
 * @version  0.2.0
 *
 * @param    {String}   cmd   The current content of the CLI
 * @param    {Object}   key   The last key pressed
 */
JanewayClass.setMethod(function autocomplete(cmd, key) {

	var pieces,
	    target,
	    hidden,
	    items,
	    item,
	    last,
	    left,
	    list,
	    keys,
	    key,
	    i;

	if (!cmd && !key) {
		return this.autocomplete_list = this.popup('autocomplete', false);
	}

	this.autocomplete_prefix = null;
	pieces = cmd.split('.');
	items = [];
	left = 1 + cmd.length;

	if (pieces.length == 1) {
		target = vm_context;
		last = cmd;
	} else {
		last = pieces.pop();
		target = Blast.Bound.Object.path(vm_context, pieces);

		this.autocomplete_prefix = pieces.join('.') + '.';
	}

	if (target) {

		// First: get its own keys
		keys = Object.keys(target);

		// Now get all the hidden ones
		hidden = Blast.Bound.Array.subtract(this.getPropertyNames(target), keys);

		for (i = 0; i < keys.length; i++) {
			item = keys[i];

			if (!last || Blast.Bound.String.startsWith(item, last)) {
				items.push(item);
			}
		}

		for (i = 0; i < hidden.length; i++) {
			item = hidden[i];

			if (!last || Blast.Bound.String.startsWith(item, last)) {
				items.push(item);
			}
		}
	}

	if (cmd.trim() && items.length) {
		list = this.popup('autocomplete', {position: {left: left, height: 6}, items: items});
	} else {
		list = this.popup('autocomplete', false);
	}

	this.autocomplete_list = list;
});

/**
 * Start Janeway
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Function}   callback
 */
JanewayClass.setMethod(function start(callback) {

	var that = this,
	    scrolledUp = false,
	    vm_options,
	    listeners,
	    logList,
	    bottom,
	    output,
	    screen,
	    status,
	    menu,
	    form,
	    cli,
	    to,
	    i;

	if (typeof callback != 'function') {
		callback = null;
	}

	if (started || starting) {
		if (callback) {
			that.afterOnce('ready', callback);
		}

		return;
	}

	vm_options = {
		filename : 'CLI'
	};

	starting = true;

	if (!process.stdout.isTTY) {

		if (callback) {
			callback(new Error('Could not start Janeway, not a valid TTY terminal'));
		}

		return console.error('Could not start Janeway, not a valid TTY terminal');
	}

	// Listen for uncaught exceptions and print them out
	// This prevents exceptions from "disappearing" if they where
	// emitted while Janeway was starting
	if (this.catch_exceptions) {

		// See if there already is an exception listener
		// (BTW: blessed will also add one, later)
		listeners = process.listeners('uncaughtException');

		// If there already is a listener, don't add ours
		// It wouldn't do anything, anyway
		if (listeners.length == 0) {
			process.on('uncaughtException', function onException(err) {

				// Do some janeway specific cleaning up
				exitHandler();

				// If another listener was added since,
				// (excluding the one added by blessed)
				// let it handle this error
				if (process.listeners('uncaughtException').length > 2) {
					return;
				}

				// Re-emit the exceptions on the Janeway instance
				if (that.re_emit_exceptions) {
					that.emit('uncaughtException', err);
				}

				// Throw the error again, node will shutdown
				// even if other uncaughtException listeners exist
				if (that.shutdown_on_exception) {
					throw err;
				} else {
					that.print('error', ['Uncaught exception:', err], {err: err})
				}
			});
		}
	}

	if (!Blast.isNW) {
		// As soon as this is required, it kicks in and takes over the screen
		blessed = require('blessed');

		// Require the custom textarea widget
		Editarea = require('./class/editarea');

		screen  = blessed.screen({output: outputs.stdout, error: outputs.stderr, handleUncaughtExceptions: false});

		// Create the interface boxes
		bottom = blessed.box({
			bottom: 1,
			width: '100%',
			content: '▶',
			height: 2,
			style: {
				bg: 'white',
				fg: 'blue'
			}
		});

		form = blessed.form({
			width: '100%',
			left: 2,
			content: 'FORM',
			style: {
				bg: 'white',
				fg: 'blue'
			}
		});


		menu = blessed.listbar(Object.assign({
			top    : 0,
			left   : 0,
			width  : '100%',
			height : 1,
			mouse  : true,
			style  : {
				bg : 'white',
				selected : {
					fg: 'black', // Shade of grey
					bg: 'white'
				}
			}
		}, configs.menu || {}));

		status = blessed.box({
			bottom : 0,
			width  : '100%',
			height : 1,
			tags   : true,
			style  : {
				bg : 'grey',
				fg : 'white'
			}
		});

		output = blessed.box({
			top: 1,
			bottom: 3,
			left: 0,
			width: '100%',
			height: screen.height-4,
			scrollable: true,
			alwaysScroll: true, // Don't turn this off, or it breaks
			content: '',
			wrap: false,
			scrollbar: {
				bg: 'blue'
			},
			style: {
				fg: 'white',
				bg: 'transparent'
			}
		});

		cli = Editarea({
			width: '100%',
			left: 0,
			bottom: 0,
			style: {
				bg: 'white',
				fg: 'blue'
			},
			//inputOnFocus: true,
			mouse: true
		});

		// Store elements in the object
		this.blessed = blessed;
		this.screen = screen;
		this.output = output;
		this.bottom = bottom;
		this.status = status;
		this.form = form;
		this.menu = menu;
		this.cli = cli;

		// Create the LogList instance
		logList = new Janeway.LogList(this, screen, output);
		this.logList = logList;
	}

	/**
	 * Keep a reference to the original `console.log`
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console._log = console.log;

	/**
	 * Hijack console.log
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 */
	console.log = function log() {
		that.print('info', arguments, {level: 1});
	};

	/**
	 * Hijack console.dir
	 * (Currently the same as log)
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.dir = function dir() {
		that.print('dir', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	/**
	 * Hijack console.info
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.info = function info() {
		that.print('info', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	/**
	 * Hijack console.warn
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.warn = function warn() {
		that.print('warn', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	/**
	 * Hijack console.error
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.error = function error() {
		that.print('error', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	if (Blast.isNW) {

		if (callback) {
			callback(new Error('Janeway does not work under nw.js'));
		}

		return;
	}

	// Prepare to hijack stdout & stderr `write` functions
	to = {
		stdout: process.stdout.write,
		stderr: process.stderr.write
	};

	/**
	 * Hijack stderr output
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	process.stderr.write = function stderrWrite(string, encoding, fd) {
		that.print('error', [''+string]);
	};

	/**
	 * Hijack stdout output
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	process.stdout.write = function stdoutWrite(string, encoding, fd) {
		that.print('info', [''+string]);
	};

	/**
	 * Handle mouse events (scrolling)
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.4
	 */
	output.on('mouse', function onMouse(e) {

		var scrolled = false;

		if (e.action == 'wheelup') {
			output.scroll(-5);
			scrolledUp = true;
			scrolled = true;
		} else if (e.action == 'wheeldown') {
			output.scroll(5);
			scrolledUp = false;
			scrolled = true;
		}

		if (scrolled) {
			that.scrolled_manually = true;

			if (output.getScrollPerc() == 100) {
				that.scrolled_manually = false;
			}

			logList.render();
		}
	});

	/**
	 * Handle mouse clicks
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.2.0
	 */
	output.on('click', function onClick(data) {

		var scrollHeight,
		    bottomIndex,
		    lineIndex,
		    topIndex,
		    gScroll,
		    scroll,
		    line,
		    str;

		// Scroll index of either top or bottom visible line
		gScroll = output.getScroll();

		// Get the current height of the scroll
		scrollHeight = that.logList.box.getScrollHeight();

		if (scrolledUp && scrollHeight > output.height) {
			// Added "-1" since 0.2.0 because of the new menubar at the top
			lineIndex = gScroll + data.y - 1;
		} else {
			bottomIndex = gScroll;

			if (scrollHeight > output.height) {
				topIndex = bottomIndex - output.height + 1;
			} else {
				topIndex = 0;
			}

			lineIndex = data.y - output.top + topIndex;
		}

		//console.log('Lid:', lineIndex, 'Gscroll', gScroll, 'Sup', scrolledUp, 'Data', data.y, 'Top', output.top, 'Height', output.height, 'Sheight', scrollHeight, 'Topindex', topIndex, 'Bottomindex', bottomIndex);

		logList.click(lineIndex, data.x, data.y);
	});

	/**
	 * Enter the currently selected value in the autocomplete list into the CLI
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.5
	 * @version  0.2.0
	 */
	function selectAutocomplete() {

		var temp,
		    path;

		// Get the selected item
		temp = that.autocomplete_list.getItem(that.autocomplete_list.selected);

		// Get the path before the last dot
		path = that.autocomplete_prefix || '';

		if (temp) {
			// Set the value and move to the end
			cli.setValue(path + temp.content, true);
			that.autocomplete();
		}
	}

	/**
	 * Handle input of the CLI
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.2.0
	 */
	cli.on('keypress', function onKeypress(e, key) {

		var result,
		    commandLine,
		    errorLine,
		    evalLine,
		    scope,
		    path,
		    temp,
		    dir,
		    cmd,
		    id;

		if (key.name == 'pagedown') {
			that.scroll(20, true);
		} else if (key.name == 'pageup') {
			that.scroll(-20, true);
		} else if (key.name == 'enter') {

			if (that.autocomplete_list) {
				return selectAutocomplete();
			}

			cmd = cli.getValue().trim();

			// Reset the index
			that.cli_history_index = -1;

			// Clear out the stash
			that.cli_stash = '';

			// Clear the CLI anyway, we don't want returns in the input
			// but it still happens, this way it'll limit to 1 return
			cli.clearValue();

			// Return if the cmd is empty
			if (!cmd) {
				return;
			}

			// If the new command differs from the last one, unshift it onto the array
			if (cmd != that.cli_history[0]) {
				that.cli_history.unshift(cmd);
			}

			if (cmd == 'cls') {
				logList.clearScreen();

				setImmediate(function() {
					cli.clearValue();
					cli.render();
				});
				return;
			} else if (cmd == 'exit') {
				process.exit();
			}

			// Create a line for the input command
			commandLine = new Janeway.CommandLogLine(logList);
			commandLine.set(esc('38;5;74', cmd));

			// Add it to the logList
			logList.pushLine(commandLine);

			try {

				// Run the command in the custom context
				try {
					// Force it to become an expression first
					result = vm.runInNewContext('(' + cmd + ')', vm_context, vm_options);
				} catch (err) {
					// In case it failed, try without parentheses
					result = vm.runInNewContext(cmd, vm_context, vm_options);
				}

				// Create a line for the output
				evalLine = new Janeway.EvalOutputLogLine(logList);
				evalLine.set([result]);

				logList.insertAfter(evalLine, commandLine.index);
			} catch (err) {
				errorLine = new Janeway.ErrorLogLine(logList);
				errorLine.set([err]);

				logList.insertAfter(errorLine, commandLine.index);
			}

			// Even though the input has been cleared,
			// the return gets added afterwards
			setImmediate(function() {
				cli.clearValue();
				cli.render();

				// Scroll along if needed
				that.scrollAlong();
			});
		} else {
			if (key.ch == '.' || key.name == 'tab' || key.ch == '(') {
				if (that.autocomplete_list) {
					selectAutocomplete();
				}
			}

			cmd = cli.getValue();

			if (key.code || key.name == 'escape') {
				// Ignore keys with codes

				// If the autocomplete list is open, listen to the arrow keys
				if (that.autocomplete_list) {
					if (key.name == 'up') {
						that.autocomplete_list.up(1);
						that.autocomplete_list.render();
					} else if (key.name == 'down') {
						that.autocomplete_list.down(1);
					} else if (key.name == 'escape') {
						that.autocomplete();
					}

					screen.render();
				} else {

					// If the autocomplete popup is not open,
					// arrow keys should cycle through the CLI history
					if (key.name == 'up') {
						dir = 1;
					} else if (key.name == 'down') {
						dir = -1;
					}

					if (dir) {

						// If the current index is -1, stash the current input
						if (that.cli_history_index == -1 && cmd) {
							that.cli_stash = cmd;
						}

						id = that.cli_history_index + dir;

						if (id == -1) {
							that.cli_history_index = -1;
							cli.setValue(that.cli_stash, true);
						} else if (that.cli_history[id] != null) {

							// Get the history entry
							temp = that.cli_history[id];

							// Set the new index
							that.cli_history_index = id;

							// Set the value in the cli
							cli.setValue(temp, true);
						}

						screen.render();
					}
				}

				return;
			} else if (key.name === 'backspace') {
				cmd = cmd.slice(0, -1);
			} else {
				cmd += e;
			}

			that.autocomplete(cmd, key);
		}
	});

	// Prepare the screen contents and render
	screen.append(bottom);
	screen.append(menu);
	screen.append(output);
	screen.append(status);
	bottom.append(form);
	form.append(cli);

	// Quit on Control-C.
	cli.key(['C-c'], function exitNow(ch, key) {
		return process.exit(0);
	});

	// The CLI is always in focus
	cli.readInput(function recurse(result) {
		cli.readInput(recurse);
	});

	/**
	 * Cleanup on exit
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.2.0
	 * @version  0.2.0
	 */
	function exitHandler(err) {

		// Unset the title
		if (that._title_has_been_set) {
			that.setTitle(false);
		}
	}

	// Do something when app is closing
	process.on('exit', exitHandler);

	// Catch Ctrl+c
	process.on('SIGINT', exitHandler);

	/**
	 * Listen to the next screen render event,
	 * only then will things be visible on the screen
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.1
	 * @version  0.1.5
	 */
	screen.once('render', function onRender() {
		that.emitOnce('ready');

		if (callback) {
			callback();
		}
	});

	// Create the main menu
	this._createMenu();

	// Create the indicator area
	this._createIndicatorArea();

	screen.render();
});

/**
 * Create the menu
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
JanewayClass.setMethod(function _createMenu() {

	var that = this,
	    button_copy;

	button_copy = blessed.box({
		parent    : this.menu,
		mouse     : true,
		autoFocus : false,
		name      : 'copy',
		content   : 'Copy JSON',
		shrink    : true,
		padding   : {
			left  : 1,
			right : 1
		},
		style     : {
			fg    : 235, // Shade of grey
			bg    : 'white',
			focus : {
				fg: 249, // Shade of grey
				bg: 'red'
			},
			hover: {
				fg: 249, // Shade of grey
				bg: 'red'
			}
		}
	});

	// Listen to button clicks, and copy the selection
	button_copy.on('click', function pressedCopy(data) {

		var selection = that.logList.current_selection,
		    json;

		if (typeof selection == 'function') {
			json = selection + '';
		} else {
			try {
				json = Blast.Bound.JSON.dry(selection, null, 2);
			} catch (err) {
				// Ignore
			}
		}

		if (json) {
			ncp.copy(json, function copied(err) {
				if (err) {
					console.log('Error copying:', err);
				}
			});
		}
	});
});

/**
 * Create the indicator area
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.1
 * @version  0.2.1
 */
JanewayClass.setMethod(function _createIndicatorArea() {

	var that = this,
	    area;

	area = blessed.box({
		parent      : this.menu,
		top         : 0,
		right       : 0,
		height      : 1,
		shrink      : true,
		mouse       : true,
		orientation : 'horizontal',
		style  : {
			bg : 'white',
			fg : 'black',
			selected : {
				fg: 'black', // Shade of grey
				bg: 'white'
			}
		}
	});

	// All indicators
	area.indicators = [];
	area.indicators_by_name = {};

	this.indicator_area = area;
});

/**
 * Render indicator area
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.1
 * @version  0.2.1
 */
JanewayClass.setMethod(function _renderIndicatorArea() {

	var indicator,
	    right,
	    i;

	// Sort the indicators
	Blast.Bound.Array.sortByPath(this.indicator_area.indicators, 'weight');

	// Get the most right position
	right = 0;

	for (i = 0; i < this.indicator_area.indicators.length; i++) {
		indicator = this.indicator_area.indicators[i];

		indicator.box.position.right = right;
		right += indicator.width;
	}

	this._initLeftHover();
});

/**
 * Set left hover text:
 * hovertext that hovers to the left in stead of right
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.1
 * @version  0.2.1
 */
JanewayClass.setMethod(function _initLeftHover() {

	var that = this;

	if (this._hoverText) {
		return;
	}

	this._hoverText = new blessed.box({
		screen: this.screen,
		right: 0,
		top: 0,
		tags: false,
		height: 'shrink',
		width: 'shrink',
		border: 'line',
		style: {
			border: {
				fg: 231,
				bg: 240
			},
			fg: 231,
			bg: 240
		}
	});

	this.screen.on('mousemove', function(data) {
		if (that._hoverText.detached) return;
		//that._hoverText.rright = that.screen.width - data.x - 1;
		that._hoverText.rtop = data.y + 1;
		that.screen.render();
	});

	this.screen.on('element mouseover', function(el, data) {

		if (!el._hoverLeftOptions) return;
		that._hoverText._over_el = el;
		that._hoverText.parseTags = el.parseTags;
		that._hoverText.setContent(el._hoverLeftOptions.text);
		that.screen.append(that._hoverText);
		that._hoverText.rright = el.position.right; // that.screen.width - data.x - 1;
		that._hoverText.rtop = data.y + 1;
		that.screen.render();
	});

	this.screen.on('element mouseout', function() {
		if (that._hoverText.detached) return;
		that._hoverText._over_el = null;
		that._hoverText.detach();
		that.screen.render();
	});

	// XXX This can cause problems if the
	// terminal does not support allMotion.
	// Workaround: check to see if content is set.
	this.screen.on('element mouseup', function(el) {
		if (!that._hoverText.getContent()) return;
		if (!el._hoverLeftOptions) return;
		that.screen.append(that._hoverText);
		that.screen.render();
	});
});

Janeway = new JanewayClass();

// Require all the classes
require('./class/log_list.js')(Janeway, Blast, Blast.Bound);
require('./class/log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/args_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/property_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/string_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/other_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/status.js')(Janeway, Blast, Blast.Bound);
require('./class/indicator.js')(Janeway, Blast, Blast.Bound);
require('./spinners.js')(Janeway, Blast, Blast.Bound);

// Expose janeway as a global
global.__Janeway = Janeway;

module.exports = Janeway;
