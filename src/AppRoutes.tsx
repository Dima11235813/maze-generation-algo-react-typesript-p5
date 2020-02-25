import React from "react";
import { Route } from "react-router";

//Views
import Home from "./views/Home/Home";
import MazeContainer from "./views/MazeContainer";
import Login from "./views/Login/Login";

export function AppRoutes() {
  return [
    <Route key="" exact path="/" component={Home} />,
    <Route key="mazeContainer" exact path="/maze" component={MazeContainer} />,
    <Route key="search" exact path="/login" component={Login} />
  ];
}
