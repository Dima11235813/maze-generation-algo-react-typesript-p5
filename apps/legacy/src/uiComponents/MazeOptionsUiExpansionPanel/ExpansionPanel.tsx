import React, { useState, FunctionComponent } from "react";

import { createStyles, makeStyles, Theme, Typography } from "@material-ui/core";

import ExpansionPanel from "@material-ui/core/ExpansionPanel";
import ExpansionPanelDetails from "@material-ui/core/ExpansionPanelDetails";
import ExpansionPanelSummary from "@material-ui/core/ExpansionPanelSummary";

import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

interface ExpansionPanelWrapperProps {
  name: string;
  panelIsExpanded: boolean;
  children?: FunctionComponent<any>;
  onPanelStateChange?: Function;
  render?: any
}

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
      },
  })
);

export const ExpansionPanelWrapper = (props: ExpansionPanelWrapperProps) => {
  const { panelIsExpanded, name, onPanelStateChange, render = () => {} } = props;
  const [expanded, setExpanded] = useState<string | false | true>(panelIsExpanded === true ? name : false);
  const classes = useStyles();
  const handleChange = (panel: string) => (
    event: React.ChangeEvent<{}>,
    isExpanded: boolean
  ) => {
    if (onPanelStateChange) {
      onPanelStateChange();
    }
    setExpanded(isExpanded ? panel : false);
  };
  return (
    <ExpansionPanel expanded={expanded === name} onChange={handleChange(name)}>
      <ExpansionPanelSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel1bh-content"
        id="panel1bh-header"
      >
        <Typography className={classes.secondaryHeading}>{name}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails>{render()}</ExpansionPanelDetails>
    </ExpansionPanel>
  );
};
