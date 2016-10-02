var MDBlocksCollection = require('./md-blocks-collection');
var MDBlock = require('./md-block-model');

/*
  Markdown parser will parse a given markdown into a collection of blocks.
 */

// Returns a blocks collection of the provided markdown string
function parseAllBlocks(md, recursive) {
  var blocks = new MDBlocksCollection();
  if (!md) return blocks;

  var offset = 0;
  var block = parseFirstBlock(md, recursive);

  // As long as there is a block join them with a text block whos type and name are non
  while (block) {
    // Check the block is the first chunk in the recent markdown
    if (block.start) {
      // If so, update the indices with the stored offset
      block.start += offset;
      block.end += offset;

      // Generate a text block with the leftover
      var text = new MDBlock({
        type: '',
        name: '',
        params: [],
        start: offset,
        end: block.start - 1 // Remove line skip
      }, md, recursive);

      blocks.push(text);
    }

    blocks.push(block);

    // Add line skip
    offset = block.end + 1;
    // Generate next blocks from the current block's end index
    block = parseFirstBlock(md.substr(offset), recursive);
  }

  // Checks if there are leftovers and if so put it in a text block
  if (offset <= md.length) {
    var text = new MDBlock({
      type: '',
      name: '',
      params: [],
      start: offset,
      end: md.length
    }, md, recursive);

    blocks.push(text);
  }

  return blocks;
}

// Parses the first block detected in a given markdown string
function parseFirstBlock(md, recursive) {
  // e.g. [}]: <match1> (match2)
  var match = md.match(/\[\{\]: <([^>]*)> \(([^\)]*)\)/);
  if (!match) return;

  // e.g. [name, param1, param2]
  var split = match[2].split(' ');

  var props = {
    type: match[1],
    name: split[0],
    params: split.slice(1),
    start: match.index,
    end: match.index + match[0].length
  };

  // e.g. [{] or [}]
  var pattern = /\[(\{|\})\]: .+/;
  var nested = 1;

  // Handle opening and closing and try to find the matching closing
  while (nested) {
    match = md.substr(props.end).match(pattern);
    // If no match found and we kept going on in this loop it means that there is
    // no closing to the detected block start
    if (!match) throw Error(props.type + ' ' + props.name + ' close not found');

    // Calculate with offset
    props.end += match.index + match[0].length;

    // Update the number of blocks open we had so far
    switch (match[1]) {
      case '{': ++nested; break;
      case '}': --nested; break;
    }
  }

  return new MDBlock(props, md, recursive);
}


module.exports = {
  parse: parseAllBlocks
};