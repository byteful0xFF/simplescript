# SimpleScript

A superset of TypeScript that reads like English. SimpleScript files (`.simple`) compile to plain TypeScript, so anything you can write in TypeScript still works.

```
x = prompt 'What do you want to say?'
log x
```

compiles to:

```ts
let x = prompt('What do you want to say?')
console.log(x)
```

## Requirements

- [Node.js](https://nodejs.org) (the compiler is a single file with no dependencies)
- Optional: `typescript` (`npm i typescript`) so `run` can handle type annotations

## Usage

```
node simplescript.js build demo.simple            # writes demo.ts (browser version)
node simplescript.js build demo.simple --nodejs   # writes demo.ts (Node version)
node simplescript.js build demo.simple -o out.ts  # choose the output file
node simplescript.js run demo.simple              # compile and run in Node
node simplescript.js demo.simple                  # shorthand for run
```

### `--nodejs`

By default `prompt` compiles to the browser's `prompt()`. With `--nodejs`, the output never uses the browser's `prompt()`. It compiles to `__prompt()`, a small function (included at the top of the output) that reads a line from stdin. `alert` becomes `console.log` in this mode.

The Node `.ts` output needs `@types/node` if you want to type-check it. `run` always uses the Node version, so you don't need the flag there.

## Language guide

### Variables

No `let` needed. The first assignment declares the variable, and later ones reassign it. Explicit `let`/`const`/`var` and type annotations still work.

```
name = 'Sam'
name = 'Alex'
count: number = 3
```

### Calling functions without parentheses

Put the arguments after the name, separated by commas.

```
log 'hello'
log 'a', 'b'
x = max 1, 5
```

Calls nest with the space style: `log shout x` becomes `console.log(shout(x))`.

### Tasks

Functions are called **tasks**. Define one with `task`, then the name and its args, comma-separated:

```
task greet, name: string, times: number {
  for i of [1, 2, 3] {
    log 'Hello, ' + name
  }
}

task sayDone {
  log 'done'
}
```

Call a task with the same comma style, or with spaces:

```
greet, 'Sam', 3
greet 'Sam', 3
sayDone
```

A bare task name on its own line is a call with no arguments. Plain `function` still works too.

### English operators

| SimpleScript | TypeScript |
| ------------ | ---------- |
| `is`         | `===`      |
| `isnt`       | `!==`      |
| `and`        | `&&`       |
| `or`         | `\|\|`     |
| `not`        | `!`        |

### Control flow

No parentheses needed around conditions, and `for` needs no `const`:

```
if x is '' or x is 'nothing' {
  log 'You said nothing'
} else if x isnt 'hi' {
  log 'ok'
} else {
  log 'hi!'
}

while count isnt 0 {
  count = count - 1
}

for n of [1, 2, 3] {
  log n
}
```

### Built-ins and renaming

| Name     | Compiles to    |
| -------- | -------------- |
| `log`    | `console.log`  |
| `warn`   | `console.warn` |
| `error`  | `console.error`|
| `prompt` | `prompt`       |
| `alert`  | `alert`        |
| `number` | `Number`       |
| `text`   | `String`       |
| `round`  | `Math.round`   |
| `floor`  | `Math.floor`   |
| `ceil`   | `Math.ceil`    |
| `random` | `Math.random`  |
| `max`    | `Math.max`     |
| `min`    | `Math.min`     |

Rename any built-in by assigning it a new name:

```
log = a
prompt = b
x = b 'What do you want to say?'
a x
```

The original names keep working. To add your own built-ins, add a line to the `BUILTINS` table at the top of `simplescript.js`.

## Editor support

`SimpleScript.tmLanguage` adds syntax highlighting for Sublime Text (it should also work in TextMate):

1. In Sublime, open **Preferences → Browse Packages** and open the `User` folder.
2. Copy `SimpleScript.tmLanguage` into it.
3. Open a `.simple` file. If it doesn't switch automatically, pick it from **View → Syntax → User**.

Renamed built-ins (like `a` above) aren't coloured as built-ins, since the syntax file can't know about aliases.

## Known limitations

- The compiler works line by line. A call without parentheses only works at the start of a statement, after `=`, after `return`, in a condition, or as an argument of another call. Something like `1 + log x` won't work.
- Comma-style calls don't nest: `log, shout, x` becomes `log(shout, x)`. Use the space style (`log shout x`) to nest.
- A bare task name is only a call when it is the whole statement. In `x = sayDone` it stays a reference to the task.
- Alias names are replaced everywhere, so an alias like `a` can't also be used as a variable name.
- Block comments (`/* */`) aren't specially handled. Use `//` comments.

## Files

| File                     | What it is                                |
| ------------------------ | ----------------------------------------- |
| `simplescript.js`        | The compiler and CLI                      |
| `demo.simple`            | Example program                           |
| `SimpleScript.tmLanguage`| Sublime Text / TextMate syntax highlighting |
| `README.md`              | This file                                 |
