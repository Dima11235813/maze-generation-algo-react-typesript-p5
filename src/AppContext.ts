
import React from 'react'
import { MazeOptions } from './mazeGenComp/mazeUtils/mazeOptions';
import { MazeOptionsSetter } from './mazeGenComp/mazeUtils/mazeOptionsSetter';

export interface P5_MazeContext {
    mazeOptions: MazeOptions;
    mazeOptionsSetter: MazeOptionsSetter;
}
let mazeOptions = new MazeOptions();
let mazeOptionsSetter = new MazeOptionsSetter(mazeOptions);
export const P5_MazeContextInitialValue: P5_MazeContext = {
    mazeOptions,
    mazeOptionsSetter
}

export const P5_MazeContext = React.createContext(P5_MazeContextInitialValue)