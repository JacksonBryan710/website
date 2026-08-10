import { NavLink } from 'react-router-dom';
import './Nav.css';

const links = [
    { to: '/about', label: 'About' },
    { to: '/now', label: 'Now' },
    { to: '/projects', label: 'Projects' },
    { to: '/cooking', label: 'Cooking' },
    { to: '/training', label: 'Training' },
];

function Nav() {
    return (
        <nav id="site-nav">
            <ul>
                {links.map((link, i) => (
                    <li key={link.to}>
                        {i > 0 && <span className="nav-sep" aria-hidden="true">★</span>}
                        <NavLink to={link.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                            {link.label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

export default Nav;
