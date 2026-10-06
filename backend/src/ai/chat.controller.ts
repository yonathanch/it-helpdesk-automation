import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';
import { ChatResultDto } from '../common/dto/api.dto';

@ApiTags('AI')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * A-4: Chatbot virtual agent.
   * POST /chat — jawaban dari RAG knowledge base; fallback menawarkan
   * buat tiket dengan prefill data chat.
   */
  @Post()
  @ApiOperation({
    summary: 'Tanya asisten virtual (A-4)',
    description: [
      'Menjawab pertanyaan dari artikel basis pengetahuan (RAG).',
      '',
      '- Bila artikel relevan ditemukan, AI menjawab dan menyertakan `sources`.',
      '- Bila tidak relevan atau AI tidak yakin, `suggestTicket` bernilai `true`',
      '  dan `prefill` berisi judul + deskripsi siap pakai untuk membuat tiket.',
      '',
      'Riwayat percakapan bersifat opsional (maksimal 20 pesan) dan dipakai',
      'sebagai konteks serta sumber prefill.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: ChatResultDto })
  @ApiBadRequestResponse({ description: 'Pesan kosong' })
  chat(@Body() dto: ChatDto, @CurrentUser('sub') userId: string) {
    return this.chatService.chat(dto, userId);
  }
}
