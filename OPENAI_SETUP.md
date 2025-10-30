# OpenAI Setup for Teleprompter Feature

## Quick Start

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Get your OpenAI API key**:
   - Visit: https://platform.openai.com/api-keys
   - Create a new secret key
   - Copy the key (you'll only see it once!)

3. **Add your key to `.env`**:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

4. **Start the app**:
   ```bash
   npm start
   ```

## Testing

1. Open Webcam Recording mode
2. Click "📝 Generate Script" button
3. Enter a topic (e.g., "benefits of creatine")
4. Enter duration in seconds (e.g., "30")
5. Click "Generate"
6. Script should appear - click "Accept"
7. Use the teleprompter controls to read!

## Fallback Mode

If you don't have an API key set, the app will use **mock script generation**. This is perfect for:
- Testing the UI
- Developing offline
- Demoing without costs

## Troubleshooting

**Script generation fails with "API error"**:
- Check your API key is correct
- Verify your OpenAI account has credits
- Check your API key permissions in OpenAI dashboard

**"Script generation timed out"**:
- Your API request took longer than 10 seconds
- This can happen if OpenAI is slow or your connection is slow
- Try again in a moment

**No API key - using mock scripts**:
- This is normal! The app will generate placeholder scripts
- Set `OPENAI_API_KEY` in `.env` to use real API

## Cost Management

- **gpt-4-turbo** (default): ~$0.01-0.03 per script
- **gpt-3.5-turbo**: ~$0.001-0.002 per script (90% cheaper!)

To use gpt-3.5-turbo instead, edit `src/main/ipc-handlers/ai.ts` line 89:
```typescript
model: 'gpt-3.5-turbo',
```

## Security Notes

- ⚠️ **Never commit `.env` to git** - it contains your API key!
- ⚠️ **Don't share your API key** - it can be used to generate costs on your account
- `.env` is already in `.gitignore` (if it exists)

---

You're all set! Your teleprompter is ready to generate scripts with OpenAI.
