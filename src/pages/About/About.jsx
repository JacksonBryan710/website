import { useEffect } from 'react';
import { Link } from 'react-router-dom';
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
                    <p>
                        Hi, I'm Jackson &mdash; I'm currently based in New York City working in fintech, where I
                        support an electronic trading platform serving institutional credit market participants
                        across the syndicated loan and CLO space. I hold the SIE, Series 7, and Series 63 licenses.
                    </p>
                    <p>
                        I studied <strong>Chemical Engineering</strong> for my Bachelor's and stayed at{' '}
                        <strong>Carnegie Mellon University</strong> for a{' '}
                        <strong>Master of Science in Management</strong>, specializing in Finance &mdash; a
                        combination that's given me both a quantitative foundation and a finance-specific toolkit.
                    </p>
                    <p>
                        Before my current role, I interned as a Process Engineer at HF Sinclair, where I worked
                        hands-on with refinery operations, and as a Product and Project Strategy intern at Volvo
                        Group, where I bridged market research and product strategy.
                    </p>
                    <p>
                        Outside of work, I'm probably either at the pool hall, in the gym, or listening to music.
                        For more of what I'm currently into, check the <Link to="/now">Now page</Link> &mdash; and{' '}
                        <Link to="/projects">Projects</Link> for what I'm building.
                    </p>
                </div>
            </main>
        </div>
    );
}

export default About;
