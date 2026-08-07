import { useEffect } from 'react';
import './Cooking.css';

const recipes = [
    {
        name: 'Cheeseburger Pasta',
        url: 'https://www.budgetbytes.com/skillet-cheeseburger-pasta/',
        prepTime: '10 mins',
        cookTime: '20 mins',
        totalTime: '30 mins',
    },
];

function Cooking() {
    useEffect(() => {
        document.title = 'Jackson Bryan: Recipes';
    }, []);

    return (
        <div id="cooking-page">
            <header>
                <h1>Recipes</h1>
            </header>

            <main>
                <table id="recipes">
                    <thead>
                        <tr>
                            <th>Recipe</th>
                            <th>Prep Time</th>
                            <th>Cook Time</th>
                            <th>Total Time</th>
                        </tr>
                    </thead>

                    <tbody>
                        {recipes.map((recipe) => (
                            <tr key={recipe.url}>
                                <td>
                                    <a href={recipe.url} target="_blank" rel="noopener noreferrer">
                                        {recipe.name}
                                    </a>
                                </td>
                                <td>{recipe.prepTime}</td>
                                <td>{recipe.cookTime}</td>
                                <td>{recipe.totalTime}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>

            <footer></footer>
        </div>
    );
}

export default Cooking;
