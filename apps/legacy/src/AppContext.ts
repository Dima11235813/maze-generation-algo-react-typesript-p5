
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
    changeView: Function,
}
let mazeOptions = new MazeOptions();
let mazeOptionsSetter = new MazeOptionsSetter(mazeOptions);
export const P5_MazeContextInitialValue: P5_MazeContext = {
    mazeOptions,
    mazeOptionsSetter,
    p5_MazeFuncs: {
        resetMaze: () => { },
        changeView: () => { }
    }
}

export const p5_MazeContext = React.createContext(P5_MazeContextInitialValue)

interface PanelIsExpandedState {
    cellSize: boolean;
    cellWallSize: boolean;
    cellColor: boolean;
    cellWallColor: boolean;
    mazeBackgroundColor: boolean;
    cellWallStyle: boolean;
    frameRate: boolean;
}
const panelIsExpandedState: PanelIsExpandedState = {
    cellSize: true,
    cellWallSize: false,
    cellColor: true,
    cellWallColor: false,
    mazeBackgroundColor: false,
    cellWallStyle: true,
    frameRate: false
}
export interface MazeOptionsUiContext {
    panelIsExpandedState: PanelIsExpandedState
}
export const MazeOptionsUiContextInitialValue: MazeOptionsUiContext = {
    panelIsExpandedState
}


export const mazeOptionsUiContext = React.createContext(MazeOptionsUiContextInitialValue)