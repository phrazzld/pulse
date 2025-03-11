# Development Preferences

## Git Commit Style
- Always use conventional commits format: `type(scope): description`
  - Types: feat, fix, docs, style, refactor, test, chore, etc.
  - Example: `feat(auth): implement GitHub OAuth login`
- Make semantically meaningful atomic commits (one logical change per commit)
- Keep commit messages clear, concise and descriptive
- Use present tense in commit messages

## Commands
### Development
- `npm run dev` - Start development server
- `npm run dev:log` - Start development server with logging to file
- `npm run logs:rotate` - Rotate log files

### Linting and Type Checking
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Project Structure
- `src/lib` - Core utilities and services
- `src/app` - Next.js app router pages and API routes
- `src/types` - TypeScript type definitions
- `scripts` - Utility scripts for development