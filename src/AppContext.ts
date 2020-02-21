
import React from 'react'
import { MazeOptions } from './mazeGenComp/mazeUtils/mazeOptions';
import { MazeOptionsSetter } from './mazeGenComp/mazeUtils/mazeOptionsSetter';

export interface P5_MazeContext {
    mazeOptions: MazeOptions;
    mazeOptionsSetter: MazeOptionsSetter;
    mazeSketch?: p5,
    p5_MazeFuncs: P5_MazeFuncs
}
export interface P5_MazeFuncs {
    resetMaze: Function,
}
let mazeOptions = new MazeOptions();
let mazeOptionsSetter = new MazeOptionsSetter(mazeOptions);
export const P5_MazeContextInitialValue: P5_MazeContext = {
    mazeOptions,
    mazeOptionsSetter,
    p5_MazeFuncs: {
        resetMaze: () => { }
    }
}

export const p5_MazeContext = React.createContext(P5_MazeContextInitialValue)