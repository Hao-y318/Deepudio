// 应用入口

import { render } from 'preact';
import { App } from './App.jsx';
import '../styles/theme.css';
import '../styles/components.css';

render(<App />, document.getElementById('app'));
