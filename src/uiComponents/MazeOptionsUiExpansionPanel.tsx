import React from "react";

import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import { Labels } from "../shared/labels";
import { ExpansionPanelWrapper } from "./MazeOptionsUiExpansionPanel/ExpansionPanel";
import { CellSizeSliderWrapper } from "./MazeOptionsUiExpansionPanel/CellSizeSliderWrapper";
import { CellWallSizeSliderWrapper } from "./MazeOptionsUiExpansionPanel/CellWallSizeSliderWrapper";
import { CellColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/CellColorSelectWrapper";
import { CellWallColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/CellWallColorSelectWrapper";
import { MazeBackgroundColorSelectWrapper } from "./MazeOptionsUiExpansionPanel/MazeBackgroundColorSelectWrapper.";
import { CellWallStyleWrapper } from "./MazeOptionsUiExpansionPanel/CellWallStyleWrapper";
import InverseColorModeToggle from "../views/AppBarItems/InverseColorModeToggle";
import Use3dModeToggle from "../views/AppBarItems/Use3dModeToggle";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%"
    }
  })
);

//TODO Move to maze options ui defaults
export default function MazeOptionsUiExpansionPanel() {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <ExpansionPanelWrapper
        panelIsExpanded={false}
        name={Labels.HEADER}
        render={() => (
          <>
            <Use3dModeToggle key="use3d" />
            <InverseColorModeToggle key="inverseColors"/>
          </>
        )}
      />
      <CellSizeSliderWrapper />
      <CellWallSizeSliderWrapper />
      <CellColorSelectWrapper />
      <CellWallColorSelectWrapper />
      <MazeBackgroundColorSelectWrapper />
      <CellWallStyleWrapper />
    </div>
  );
}
