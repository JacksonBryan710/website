import { useEffect } from 'react';
import HevyStreak from '../../components/HevyStreak/HevyStreak';
import HevyLatestLift from '../../components/HevyLatestLift/HevyLatestLift';
import HevyFrequency from '../../components/HevyFrequency/HevyFrequency';
import HevyMuscleSplit from '../../components/HevyMuscleSplit/HevyMuscleSplit';
import HevyPersonalRecords from '../../components/HevyPersonalRecords/HevyPersonalRecords';
import HevyDurationTrend from '../../components/HevyDurationTrend/HevyDurationTrend';
import './Training.css';

function Training() {
    useEffect(() => {
        document.title = 'Jackson Bryan: Training';
    }, []);

    return (
        <div id="training-page" className="page">
            <header>
                <h1 className="page-title">Training</h1>
                <p className="training-subtitle">Pulled from Hevy.</p>
            </header>

            <main>
                <div className="training-row training-row-2col">
                    <HevyStreak />
                    <HevyLatestLift />
                </div>
                <div className="training-row">
                    <HevyFrequency />
                </div>
                <div className="training-row training-row-muscle">
                    <HevyMuscleSplit />
                    <HevyPersonalRecords />
                </div>
                <div className="training-row">
                    <HevyDurationTrend />
                </div>
            </main>
        </div>
    );
}

export default Training;
