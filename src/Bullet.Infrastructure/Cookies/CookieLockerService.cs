using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Infrastructure.Cookies;

public interface ICookieLocker
{
    Task<List<CookieRecord>> GetCookiesAsync(Guid rangeId, string? domain = null);
    Task StoreCookieAsync(Guid rangeId, string domain, string name, string value, string? path = "/", DateTime? expires = null, bool secure = false, bool httpOnly = false, string sameSite = "Lax");
    Task DeleteCookieAsync(Guid cookieId);
    Task ClearRangeCookiesAsync(Guid rangeId);
}

public class CookieLockerService : ICookieLocker
{
    private readonly BulletDbContext _db;

    public CookieLockerService(BulletDbContext db)
    {
        _db = db;
    }

    public async Task<List<CookieRecord>> GetCookiesAsync(Guid rangeId, string? domain = null)
    {
        var now = DateTime.UtcNow;
        var query = _db.Cookies.Where(c => c.RangeId == rangeId && (c.ExpiresUtc == null || c.ExpiresUtc > now));
        var cookies = await query.OrderBy(c => c.Domain).ThenBy(c => c.Name).ToListAsync();

        if (!string.IsNullOrWhiteSpace(domain))
        {
            cookies = cookies.Where(c => DomainMatches(c.Domain, domain)).ToList();
        }

        return cookies;
    }

    public async Task StoreCookieAsync(Guid rangeId, string domain, string name, string value, string? path = "/", DateTime? expires = null, bool secure = false, bool httpOnly = false, string sameSite = "Lax")
    {
        var normalizedPath = string.IsNullOrWhiteSpace(path) ? "/" : path;
        var normalizedDomain = domain.Trim().ToLowerInvariant();

        var existing = await _db.Cookies.FirstOrDefaultAsync(c => 
            c.RangeId == rangeId && 
            c.Domain == normalizedDomain && 
            c.Name == name && 
            c.Path == normalizedPath);

        if (existing != null)
        {
            existing.Value = value;
            existing.ExpiresUtc = expires;
            existing.IsSecure = secure;
            existing.IsHttpOnly = httpOnly;
            existing.SameSite = sameSite;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {
            _db.Cookies.Add(new CookieRecord
            {
                RangeId = rangeId,
                Domain = normalizedDomain,
                Name = name,
                Value = value,
                Path = normalizedPath,
                ExpiresUtc = expires,
                IsSecure = secure,
                IsHttpOnly = httpOnly,
                SameSite = sameSite,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
    }

    public static bool DomainMatches(string cookieDomain, string requestHost)
    {
        if (string.IsNullOrWhiteSpace(cookieDomain) || string.IsNullOrWhiteSpace(requestHost))
            return false;

        var cleanCookieDomain = cookieDomain.Trim().TrimStart('.').ToLowerInvariant();
        var cleanRequestHost = requestHost.Trim().TrimStart('.').ToLowerInvariant();

        if (cleanCookieDomain == cleanRequestHost)
            return true;

        if (cleanRequestHost.EndsWith("." + cleanCookieDomain, StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    public async Task DeleteCookieAsync(Guid cookieId)
    {
        var cookie = await _db.Cookies.FindAsync(cookieId);
        if (cookie != null)
        {
            _db.Cookies.Remove(cookie);
            await _db.SaveChangesAsync();
        }
    }

    public async Task ClearRangeCookiesAsync(Guid rangeId)
    {
        var cookies = await _db.Cookies.Where(c => c.RangeId == rangeId).ToListAsync();
        _db.Cookies.RemoveRange(cookies);
        await _db.SaveChangesAsync();
    }
}
