import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './Projects.css';

function Projects() {
    const [projects, setProjects] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        document.title = 'Jackson Bryan: Projects';
    }, []);

    useEffect(() => {
        let cancelled = false;

        supabase
            .from('projects')
            .select('*')
            .order('sort_order', { ascending: true })
            .then(({ data, error: fetchError }) => {
                if (cancelled) return;
                if (fetchError) throw fetchError;
                setProjects(data);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div id="projects-page">
            <header>
                <h1>Projects</h1>
            </header>

            <main>
                {error && <p className="status-note">Couldn't load projects right now.</p>}
                {!error && !projects && <p className="status-note">Loading projects&hellip;</p>}

                {projects && projects.length > 0 && (
                    <ul className="project-list">
                        {projects.map((project) => (
                            <li key={project.id} className="retro-box project-card">
                                <h2>{project.name}</h2>
                                <p>{project.description}</p>
                                <p className="project-tech">Built with: {project.tech}</p>
                                <a
                                    className="badge-link"
                                    href={project.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {project.link_label}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="retro-box under-construction">
                    <p>// more projects coming soon</p>
                </div>
            </main>
        </div>
    );
}

export default Projects;
