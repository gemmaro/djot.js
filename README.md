# djot.js

A library and command-line tool for parsing and
rendering the light markup format [djot](https://djot.net).

This is a typescript rewrite of [djot's original lua
implementation](https://github.com/jgm/djot.lua).
It is currently powering the [djot
playground](https://djot.net/playground).

## Script API

These are available after you run `npm install`, which will
install the library's build dependencies:

| `npm run ...`    | Description                                    |
| ---------------- | -----------                                    |
| `build`          | Compile and bundle sources to `lib` and `dist` |
| `test`           | Run tests                                      |
| `bench`          | Run benchmarks                                 |

## Installing the command line utility

You can install the command-line utility `djot` via

```
npm install -g djot-js
```

`djot --help` will give a summary of options. For more
extensive documentation, use `man djot` or see the
[man page online](https://github.com/jgm/djot.js/blob/main/doc/djot.md).

You can use `djot` to

- convert from djot to HTML
- show the low-level event stream generated by the djot parser
- show the AST produced by the djot parser, in JSON or compact form
- convert from a JSON-formatted djot AST to djot or HTML
- alter the AST using filters
- convert from djot to pandoc JSON which can be read by pandoc
- convert pandoc JSON (or djot) to djot

For example, to convert a `gfm` document `mydoc.md` to djot,

```
pandoc mydoc.md -f gfm -t json | djot -f pandoc -t djot > mydoc.dj
```

And to convert back to `gfm`,

```
djot mydoc.dj -t pandoc | pandoc -f json -t gfm
```

## Library API

### Parsing djot to an AST

`parse(input : string, options : ParseOptions = {})`

Example of usage:

``` js
djot.parse("hello _there_", {sourcePositions: true});
```

`options` can have the following (optional) fields:

- `sourcePositions : boolean`: include source positions in the AST
- `warn : (message : Warning) => void`:
  function used to handle warnings from the parser.

A warning can be rendered using the `render()` method, so
to render warnings to the console, for example, you could do:

```
{ warn: (warning) => console.log(warning.render()) }
```

Alternatively, you can directly access the fields
`message` (string), `offset` (number if defined),
and `pos` (`{ line: number, col: number, offset: number }` if defined).

### Parsing djot to a stream of events

`new EventParser(input : string, options : Options = {})`

Exposes an iterator over events, each with the form
`{startpos : number, endpos : number, annot : string}`.
Example of usage:

```js
for (let event in new djot.EventParser("Hi _there_")) {
  console.log(event)
}
```

The `Options` object has a `warn` property as described for `parse`,
above.

### Pretty-printing the djot AST

`renderAST(doc : Doc) : string`

Example of usage:

``` js
console.log(djot.renderAST(djot.parse("hi _there_")));
```

### Rendering the djot AST to HTML

`renderHTML(ast : Doc, options : HTMLRenderOptions = {})`

`HTMLRenderOptions` extends `Options` with an `overrides`
field, which maps node tags to overrides for their renderers.

Example of usage:

``` js
console.log(djot.renderHTML(djot.parse("- _hi_",{sourcePositions:true})));
```

Simple example of an override:

``` js
djot.renderHTML(
  djot.parse("_hi_"),
  { sourcePositions: true,
    overrides: {
      emph: (node, renderer) => {
        return
          `<span class="emphasized">${renderer.renderChildren(node)}</span>`;
      }
    } });
```

This yields: `<span class="emphasized">hi</span>`.

### Rendering djot

`renderDjot(doc : Doc, options : DjotRenderOptions = {}) : string`

`DjotRenderOptions` extends `Options` with a `wrapWidth : number` field.
Its effect is as follows:

- `wrapWidth > 0`: Output is wrapped to fit in the width, with `soft_break'
  acting like a space.
- `wrapWidth = 0`: Output is not wrapped; `soft_break` renders
  as a line break.
- `wrapWidth = -1`: Output is not wrapped; `soft_break` renders
  as a space.

Example of usage:

``` js
console.log(djot.renderDjot(djot.parse("_Hello_ world"), {wrapWidth: 64}));
```


### Pandoc interoperability

`toPandoc(doc : Doc, options : PandocRenderOptions) : Pandoc`

`PandocRenderOptions` extends `Options` with
`smartPunctuationMap`, which has the form and default values:

``` js
{ non_breaking_space: " ",
  ellipses: "⋯",
  em_dash: "-",
  en_dash: "-",
  left_single_quote: "‘",
  right_single_quote: "’",
  left_double_quote: "“",
  right_double_quote: "”" };
```

Example of usage:

``` js
console.log(JSON.stringify(djot.toPandoc(djot.parse("- one\n- two\n"))));
```


`fromPandoc(pandoc : Pandoc, options : Options) : Doc`

Example of usage:

``` js
let ast = djot.fromPandoc(JSON.parse(pandocJSON));
```

### Filters

`applyFilter(node : Doc, filter : Filter)`

Example of usage:

``` js
const capitalizeFilter = () => {
  return {
           str: (e) => {
             e.text = e.text.toUpperCase();
           }
  };
};
let ast = djot.parse("Hi there `verbatim`");
djot.applyFilter(ast, capitalizeFilter);
```

Filters are JavaScript programs that modify the parsed document
prior to rendering.  Here is an example of a filter that
capitalizes all the content text in a document:

```
// This filter capitalizes regular text, leaving code and URLs unaffected
return {
  str: (el) => {
    el.text = el.text.toUpperCase();
  }
}
```

Save this as `caps.js` use tell djot to use it using

```
djot --filter caps input.js
```

Note: never run a filter from a source you don't trust,
without inspecting the code carefully. Filters are programs,
and like any programs they can do bad things on your system.

Here's a filter that prints a list of all the URLs you
link to in a document.  This filter doesn't alter the
document at all; it just prints the list to stderr.

```
return {
  link: (el) => {
    process.stderr:write(el.destination + "\n")
  }
}
```

A filter walks the document's abstract syntax tree, applying
functions to like-tagged nodes, so you will want to get familiar
with how djot's AST is designed. The easiest way to do this is
to use `djot --ast` or `djot --astpretty`.

By default filters do a bottom-up traversal; that is, the
filter for a node is run after its children have been processed.
It is possible to do a top-down travel, though, and even
to run separate actions on entering a node (before processing the
children) and on exiting (after processing the children). To do
this, associate the node's tag with a table containing `enter` and/or
`exit` functions.  The `enter` function is run when we traverse
*into* the node, before we traverse its children, and the `exit`
function is run after we have traversed the node's children.
For a top-down traversal, you'd just use the `enter` functions.
If the tag is associated directly with a function, as in the
first example above, it is treated as an `exit' function.

The following filter will capitalize text
that is nested inside emphasis, but not other text:

``` js
// This filter capitalizes the contents of emph
// nodes instead of italicizing them.
let capitalize = 0;
return {
   emph: {
     enter: (e) => {
       capitalize = capitalize + 1;
     },
     exit: (e) => {
       capitalize = capitalize - 1;
       e.tag = "span";
     },
   },
   str: (e) => {
     if (capitalize > 0) {
       e.text = e.text.toUpperCase();
      }
   }
}
```

It is possible to inhibit traversal into the children of a node,
by having the `enter` function return the value true (or any truish
value, say `"stop"`).  This can be used, for example, to prevent
the contents of a footnote from being processed:

``` js
return {
 footnote: {
   enter: (e) => {
     return true
    }
  }
}
```

A single filter may return a table with multiple tables, which will be
applied sequentially:

``` js
// This filter includes two sub-filters, run in sequence
return [
  { // first filter changes (TM) to trademark symbol
    str: (e) => {
      e.text = e.text.replace(/\\(TM\\)/, "™");
    }
  },
  { // second filter changes '[]' to '()' in text
    str: (e) => {
      e.text = e.text.replace(/\\(/,"[").replace(/\\)/,"]");
    }
  }
]
```

Here is a simple filter that changes letter enumerated lists
to roman-numbered:

``` js
// Changes letter-enumerated lists to roman-numbered
return {
  list: (e) => {
    if (e.style === 'a.') {
      e.style = 'i.';
    } else if (e.style === 'A.') {
      e.style = 'I.';
    }
  }
}
```

## The AST

The most human-readable documentation for the djot AST format
is the [typescript type
definitions](https://github.com/jgm/djot.js/blob/main/src/ast.ts).

There is also a [JSON
schema](https://github.com/jgm/djot.js/blob/main/djot-schema.json)
which can be used to verify conformity to the AST programatically.

