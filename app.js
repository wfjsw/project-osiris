#!/usr/bin/env Node

'use strict';

const Telegram = require('./libtelegrambot');
const fs = require('fs');
const config = require('./config.json');

var bot = new Telegram(config['api-key'], config['options']);

const message_type = ['text', 'audio', 'document', 'photo', 'sticker', 'video', 'voice', 'contact', 'location', 'venue', 'new_chat_member', 'left_chat_member', 'new_chat_title', 'new_chat_photo', 'delete_chat_photo', 'group_chat_created', 'pinned_message'];
const inline_type = ['inline_query', 'chosen_inline_result', 'callback_query'];
var global_e = {
    bot: bot,
    me: {},
    libs: {},
    plugins: {},
    preprocessors: [],
    runners: [],

    msgtype_listeners: {},
    edited_listeners: [],
    regex_listeners: []
};

function getAllLibrarySync() {
    return fs.readdirSync('lib');
}

function getAllPluginsSync() {
    return fs.readdirSync('plugins');
}

function getJsFilename(original) {
    var match = /^(.*)\.js$/.exec(original);
    if (match)
        return match[1];
    else
        return false;
}

function loadLib(id) {
    if (global_e.libs[id]) delete global_e.libs[id];
    global_e.libs[id] = require(`./lib/${id}.js`);
}

function loadAllLib() {
    global_e.libs = [];
    var libfiles = getAllLibrarySync();
    libfiles.forEach((targetlib) => {
        var libname = getJsFilename(targetlib);
        if (!libname) return;
        if (libname.slice(0,9).toLowerCase() == 'disabled_') return;

        console.log(`Loading library ${targetlib} ...`);
        global_e.libs[libname] = require(`./lib/${targetlib}`);
        if (global_e.libs[libname].init) 
                global_e.libs[libname].init(global_e);
    }) 
}

function loadAllPlugin() {
    global_e.plugins = [];
    var plgfiles = getAllPluginsSync();
    plgfiles.forEach((targetplg) => {
        var plgname = getJsFilename(targetplg);

        if (!plgname) return;
        if (plgname.slice(0,9).toLowerCase() == 'disabled_') return;

        console.log(`Loading plugin ${targetplg} ...`);
        global_e.plugins[plgname] = require(`./plugins/${targetplg}`);
        if (global_e.plugins[plgname].init) global_e.plugins[plgname].init(global_e);
        if (global_e.plugins[plgname].preprocess)
            global_e.preprocessors.push(global_e.plugins[plgname].preprocess);
        if (global_e.plugins[plgname].run)
            global_e.plugins[plgname].run.forEach((runobj) => {
                global_e.runners.push(runobj);
            })
    }) 
}

function diverseListeners() {
    message_type.forEach((type) => {
        global_e.msgtype_listeners[type] = []; // init array
    });
    inline_type.forEach((type) => {
        global_e.msgtype_listeners[type] = []; // init array
    });
    global_e.edited_listeners[type] = []; // init array
    global_e.runners.forEach(([test, callback]) => {
        // Diverse MediaType Listeners
        if ((test.constructor == String) && ((message_type.indexOf(test) > -1) || (inline_type).indexOf(test) > -1))
            global_e.msgtype_listeners[test].push(callback);
        else if (test == 'edited_message') 
            global_e.edited_listeners.push(callback);
        // Diverse RegExpression Listeners
        else if (test instanceof RegExp) 
            global_e.regex_listeners.push([test, callback]);
    });
}

loadAllLib();
loadAllPlugin();
diverseListeners();

function trimCmd(command) {
    try {
        if (command.slice(0,1) == '/') {
            var t1 = command.split(' ');
            var t2 = t1[0].split('@')
            if (t2.length > 1) {
                var t3 = t2.pop();
                if (t3 == global_e.me.username) {
                    t1.shift();
                    return t2.concat(t1).join(' ');
                } else {
                    return command;
                }
            } else {
                return command;
            }
        } else {
            return command;
        }
    } catch (e) {
        console.error(e);
    }
}

bot.on('message', (msg) => {
    // Preprocessor hook all messages
    try {
    global_e.preprocessors.forEach((preprocessor) => {
        preprocessor(msg, bot);
    });

    // Process MediaTypes
    message_type.forEach((type) => {
        if (msg[type]) 
            global_e.msgtype_listeners[type].forEach((cb) => {
                cb(msg, type, bot);
            });
    });
    
    var trimmed = trimCmd(msg.text);
    // Process RegExp
    global_e.regex_listeners.forEach( ([test, callback]) => {
        var matches;
        if (msg.text) matches = test.exec(trimmed);
        else if (msg.caption) matches = test.exec(msg.caption);
        if (matches)
            callback(msg, matches, bot);
    });
    } catch (e) {
        console.error(e);
    }
});

bot.on('edited_message', (msg) => {
    try {
        global_e.edited_listeners.forEach((cb) => {
            cb(msg, 'edited_message', bot);
        });
    } catch (e) {
        console.error(e);
    }
});

inline_type.forEach((type) => {
    bot.on(type, (msg) => {
        global_e.msgtype_listeners[type].forEach((cb) => {
            cb(msg, type, bot);
        });
    })
});

bot.getMe().then((ret) => {
    global_e.me = ret;
    console.log(ret);
})
