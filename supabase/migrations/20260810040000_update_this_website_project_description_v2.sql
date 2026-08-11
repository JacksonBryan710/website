update public.projects
set description = 'A personal site built with React and Vite. Supabase backend, deployed on GitHub Pages. Includes a scheduled Edge Function that pulls Letterboxd and Goodreads activity into a cache table for the Now page, and a Training page backed by a Hevy webhook and daily sync job, rendering workout streak, frequency, muscle split, personal records, and duration trend widgets.'
where name = 'This Website';
