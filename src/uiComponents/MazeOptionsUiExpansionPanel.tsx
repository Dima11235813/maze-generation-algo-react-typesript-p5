import React, { useContext, useState } from "react";

import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import { p5_MazeContext, P5_MazeContext } from "../AppContext";
import CellWallSizeSlider from "./CellWallSizeSlider";
import { SketchPicker } from "react-color";
import { Labels } from "../shared/labels";
import { FormControl, Select, MenuItem } from "@material-ui/core";
import { ExpansionPanelWrapper } from "./MazeOptionsUiExpansionPanel/ExpansionPanel";
import { CellSizeSliderWrapper } from "./MazeOptionsUiExpansionPanel/CellSizeSliderWrapper";
import { CellWallSizeSliderWrapper } from "./MazeOptionsUiExpansionPanel/CellWallSizeSliderWrapper";
import { CellColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/CellColorSelectWrapper";
import { CellWallColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/CellWallColorSelectWrapper";
import { MazeBackgroundColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/MazeBackgroundColorSelectWrapper.";
import { CellWallStyleWrapper } from "./MazeOptionsUiExpansionPanel/CellWallStyleWrapper";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%"
    }
  })
);

//TODO Move to maze options ui defaults
export default function MazeOptionsUiExpansionPanel() {
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <ExpansionPanelWrapper name={Labels.HEADER} />
      <CellSizeSliderWrapper />
      <CellWallSizeSliderWrapper />
      <CellColorSelectWrapper />
      <CellWallColorSelectWrapper />
      <MazeBackgroundColorSelectWrapper />
      <CellWallStyleWrapper />
    </div>
  );
}
