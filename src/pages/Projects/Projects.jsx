import { useEffect } from 'react';
import './Projects.css';

const projects = [
    {
        name: 'This Website',
        description:
            "You're looking at it. A hand-built personal site, put together in the spirit of the indie web " +
            'revival instead of a template or a page builder. It felt right for the first project listed here ' +
            'to be the recursive one.',
        tech: 'React, Vite, React Router',
        href: 'https://github.com/JacksonBryan710/website',
        linkLabel: 'View source',
    },
];

function Projects() {
    useEffect(() => {
        document.title = 'Jackson Bryan: Projects';
    }, []);

    return (
        <div id="projects-page">
            <header>
                <h1>Projects</h1>
            </header>

            <main>
                <ul className="project-list">
                    {projects.map((project) => (
                        <li key={project.name} className="retro-box project-card">
                            <h2>{project.name}</h2>
                            <p>{project.description}</p>
                            <p className="project-tech">Built with: {project.tech}</p>
                            <a className="badge-link" href={project.href} target="_blank" rel="noopener noreferrer">
                                {project.linkLabel}
                            </a>
                        </li>
                    ))}
                </ul>

                <div className="retro-box under-construction">
                    <p>// more projects coming soon</p>
                </div>
            </main>
        </div>
    );
}

export default Projects;
