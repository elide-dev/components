/**
 * Box drawing and block elements a terminal draws itself rather than taking from the font. Each
 * becomes a cell (`data-glyph`) that `code-surface.css` paints at full row height, so block art
 * meets across rows and box lines join; the character stays in the DOM for copy.
 */
export const DRAWN = /[─━│┃┌┐└┘├┤┬┴┼╭╮╯╰═║╔╗╚╝█▏▎▍▌▋▊▉▁▂▃▄▅▆▇▀▔▐▕░▒▓]/;
