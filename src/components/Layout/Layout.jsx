import { Outlet } from 'react-router-dom';
import Nav from '../Nav/Nav';
import './Layout.css';

function Layout() {
    return (
        <div id="site-shell">
            <Nav />
            <div id="site-content">
                <Outlet />
            </div>
        </div>
    );
}

export default Layout;
