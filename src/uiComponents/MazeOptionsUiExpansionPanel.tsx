import React, { useContext, useState } from "react";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import InboxIcon from "@material-ui/icons/MoveToInbox";
import MailIcon from "@material-ui/icons/Mail";

import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import ExpansionPanel from "@material-ui/core/ExpansionPanel";
import ExpansionPanelDetails from "@material-ui/core/ExpansionPanelDetails";
import ExpansionPanelSummary from "@material-ui/core/ExpansionPanelSummary";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import MazeOptionsUi from "./MazeOptionsUi";
import { p5_MazeContext, P5_MazeContext } from "../AppContext";
import CellSizeSlider from "./CellSizeSlider";
import CellWallSizeSlider from "./CellWallSizeSlider";
import { SketchPicker } from "react-color";
import { Labels } from "../shared/labels";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%"
    },
    heading: {
      fontSize: theme.typography.pxToRem(15),
      flexBasis: "33.33%",
      flexShrink: 0
    },
    secondaryHeading: {
      fontSize: theme.typography.pxToRem(15),
      color: theme.palette.text.secondary
    }
  })
);

enum MazeOptionPanels {
  CELL_SIZE = "cellSizePanel",
  CELL_WALL_SIZE = "cellWallSizePanel",
  CELL_COLOR = "cellColor",
  CELL_WALL_COLOR = "cellWallColor",
  MAZE_BACKGROUND_COLOR = "mazeBackgroundColor"
}

//TODO Move to maze options ui defaults
export default function MazeOptionsUiExpansionPanel() {
  const CELL_SIZE_PANEL_DEFAULT = true;
  const CELL_COLOR_PANEL_DEFAULT = true;
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  const { mazeOptionsSetter, mazeOptions, p5_MazeFuncs } = mazeContext!;
  const { resetMaze } = p5_MazeFuncs;
  const classes = useStyles();
  const [expanded1, setExpanded1] = useState<string | false | true>(
    CELL_SIZE_PANEL_DEFAULT
  );
  const [expanded2, setExpanded2] = useState<string | false | true>(false);
  const [expanded3, setExpanded3] = useState<string | false | true>(
    CELL_COLOR_PANEL_DEFAULT
  );
  const [expanded4, setExpanded4] = useState<string | false | true>(false);
  const [expanded5, setExpanded5] = useState<string | false | true>(false);

  const handleChange = (panel: string) => (
    event: React.ChangeEvent<{}>,
    isExpanded: boolean
  ) => {
    switch (panel) {
      case MazeOptionPanels.CELL_SIZE:
        setExpanded1(isExpanded ? panel : false);
        break;
      case MazeOptionPanels.CELL_WALL_SIZE:
        setExpanded2(isExpanded ? panel : false);
        break;
      case MazeOptionPanels.CELL_COLOR:
        setExpanded3(isExpanded ? panel : false);
        break;
      case MazeOptionPanels.CELL_WALL_COLOR:
        setExpanded4(isExpanded ? panel : false);
        break;
      case MazeOptionPanels.MAZE_BACKGROUND_COLOR:
        setExpanded5(isExpanded ? panel : false);
        break;
      default:
        break;
    }
  };
  return (
    <div className={classes.root}>
      <ExpansionPanel
        expanded={expanded1 === MazeOptionPanels.CELL_SIZE}
        onChange={handleChange(MazeOptionPanels.CELL_SIZE)}
      >
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography className={classes.heading}>
            Maze General settings
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          {/* TODO Add ability to toggle panel state defaults */}
        </ExpansionPanelDetails>
      </ExpansionPanel>
      <ExpansionPanel
        expanded={expanded1 === MazeOptionPanels.CELL_SIZE}
        onChange={handleChange(MazeOptionPanels.CELL_SIZE)}
      >
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography id="input-slider" className={classes.secondaryHeading}>
            {Labels.CELL_WIDTH_LABEL}
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <CellSizeSlider
            mazeOptionsSetter={mazeOptionsSetter}
            onSizeChange={resetMaze}
            windowWidth={mazeOptions.windowWidth}
            cellSize={mazeOptions.cellSize}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
      <ExpansionPanel
        expanded={expanded2 === MazeOptionPanels.CELL_WALL_SIZE}
        onChange={handleChange(MazeOptionPanels.CELL_WALL_SIZE)}
      >
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography
            className={classes.secondaryHeading}
            id="input-slider"
            gutterBottom
          >
            {Labels.CELL_WALL_WIDTH}
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <CellWallSizeSlider
            mazeOptionsSetter={mazeOptionsSetter}
            cellWallSize={mazeOptions.cellWallSize}
            maxStrokeWidth={mazeOptions.maxStrokeWidth}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
      <ExpansionPanel
        expanded={expanded3 === MazeOptionPanels.CELL_COLOR}
        onChange={handleChange(MazeOptionPanels.CELL_COLOR)}
      >
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography className={classes.secondaryHeading}>
            Cell Color
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <SketchPicker
            color={mazeOptions.cellColor}
            onChange={mazeOptionsSetter.handleCellColorChange}
            // onChangeComplete={handleColorChangeComplete}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
      <ExpansionPanel
        expanded={expanded4 === MazeOptionPanels.CELL_WALL_COLOR}
        onChange={handleChange(MazeOptionPanels.CELL_WALL_COLOR)}
      >
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography className={classes.secondaryHeading}>
            Cell Wall Color
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <SketchPicker
            color={mazeOptions.cellWallColor}
            onChange={mazeOptionsSetter.handleCellWallColorChange}
            // onChangeComplete={handleColorChangeComplete}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
      <ExpansionPanel
        expanded={expanded5 === MazeOptionPanels.MAZE_BACKGROUND_COLOR}
        onChange={handleChange(MazeOptionPanels.MAZE_BACKGROUND_COLOR)}
      >
        <ExpansionPanelSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography className={classes.secondaryHeading}>
            Background Color
          </Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          <SketchPicker
            color={mazeOptions.backgroundColor}
            onChange={mazeOptionsSetter.handleBackgroundColorChange}
            // onChangeComplete={handleColorChangeComplete}
          />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    </div>
  );
}
