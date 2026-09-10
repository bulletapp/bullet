using Bullet.Domain.Entities;
using Bullet.Execution.Tls;

namespace Bullet.Execution;

public interface IHttpMessageHandlerProvider
{
    HttpMessageHandler CreateHandler(TLSProfile? profile, bool verifySsl = true);
}

public class DefaultHttpMessageHandlerProvider : IHttpMessageHandlerProvider
{
    private readonly ITlsManager _tlsManager;

    public DefaultHttpMessageHandlerProvider(ITlsManager tlsManager)
    {
        _tlsManager = tlsManager;
    }

    public HttpMessageHandler CreateHandler(TLSProfile? profile, bool verifySsl = true)
    {
        return _tlsManager.CreateConfiguredHandler(profile, verifySsl);
    }
}
