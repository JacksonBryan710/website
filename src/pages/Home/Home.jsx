import './Home.css';
import bombImg from './assets/bomb.png'

function Home() {
    return (
        <div id='bomb-casing'>
            <img id='bomb' src={bombImg} alt="Bomb" />
        </div>
    );
}

export default Home