import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';

/**
 * A-4: Chatbot virtual agent.
 * POST /chat — jawaban dari RAG knowledge base; fallback menawarkan
 * buat tiket dengan prefill data chat.
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() dto: ChatDto, @CurrentUser('sub') userId: string) {
    return this.chatService.chat(dto, userId);
  }
}
