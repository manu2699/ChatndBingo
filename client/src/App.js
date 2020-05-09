import React from 'react';
import { Route, BrowserRouter as Router, Switch } from "react-router-dom";
import Home from './components/home';
import OnRoom from './components/onRoom';

const App = () => (
  <Router>
    <Switch>
      <Route exact path="/" component={Home} />
      <Route exact path="/room/:id" render={(props) => <OnRoom {...props} isRoomCreated="false" />} />
    </Switch>
  </Router>
);
export default App;
