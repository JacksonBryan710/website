import { useEffect } from 'react';
// import { Link } from 'react-router-dom'; // needed again once the bio block below is restored
import './About.css';

function About() {
    useEffect(() => {
        document.title = 'Jackson Bryan: About';
    }, []);

    return (
        <div id="about-page" className="page">
            <header>
                <h1 className="page-title">About Me</h1>
            </header>

            <main>
                <div className="retro-box">
                    <p>// bio coming soon</p>
                </div>
                {/*
                <div className="retro-box">
                    <p>
                        Hi, I'm Jackson. I'm currently a <strong>Market and Client Support Associate</strong>.
                    </p>
                    <p>
                        My background is a bit of a zigzag: I studied <strong>Chemical Engineering</strong> for my
                        Bachelor's, then went back for a <strong>Master of Science in Management</strong>,
                        specializing in Finance &mdash; both at <strong>Carnegie Mellon University</strong>.
                    </p>
                    <p>
                        I'm still figuring out exactly how to describe what I'm capable of. Rather than write a
                        skills list I don't fully believe yet, I'd rather show it over time &mdash; check the{' '}
                        <Link to="/now">Now page</Link> for what I'm currently into, and the{' '}
                        <Link to="/projects">Projects page</Link> for what I'm building.
                    </p>
                </div>
                */}
            </main>
        </div>
    );
}

export default About;
