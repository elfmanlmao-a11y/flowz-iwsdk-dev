// src/types/three-font.d.ts
declare module 'three/examples/jsm/libs/opentype.module.js' {
  export class Font {
    constructor(json: any);
    data: any;
    glyphs: any;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: any): any;
    getPaths(text: string, x: number, y: number, fontSize: number, options?: any): any[];
  }
}